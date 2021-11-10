package userpasswd

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/inconshreveable/log15"

	"github.com/sourcegraph/sourcegraph/cmd/frontend/auth"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/backend"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/hubspot"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/hubspot/hubspotutil"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/internal/session"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/internal/suspiciousnames"
	"github.com/sourcegraph/sourcegraph/internal/actor"
	"github.com/sourcegraph/sourcegraph/internal/authz"
	"github.com/sourcegraph/sourcegraph/internal/conf"
	"github.com/sourcegraph/sourcegraph/internal/cookie"
	"github.com/sourcegraph/sourcegraph/internal/database"
	"github.com/sourcegraph/sourcegraph/internal/database/dbutil"
	"github.com/sourcegraph/sourcegraph/internal/deviceid"
	"github.com/sourcegraph/sourcegraph/internal/errcode"
	"github.com/sourcegraph/sourcegraph/internal/featureflag"
	"github.com/sourcegraph/sourcegraph/internal/types"
	"github.com/sourcegraph/sourcegraph/internal/usagestats"
)

type credentials struct {
	Email           string `json:"email"`
	Username        string `json:"username"`
	Password        string `json:"password"`
	AnonymousUserID string `json:"anonymousUserId"`
	FirstSourceURL  string `json:"firstSourceUrl"`
}

// HandleSignUp handles submission of the user signup form.
func HandleSignUp(db database.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if handleEnabledCheck(w) {
			return
		}
		if pc, _ := getProviderConfig(); !pc.AllowSignup {
			http.Error(w, "Signup is not enabled (builtin auth provider allowSignup site configuration option)", http.StatusNotFound)
			return
		}
		handleSignUp(db, w, r, false)
	}
}

// HandleSiteInit handles submission of the site initialization form, where the initial site admin user is created.
func HandleSiteInit(db database.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// This only succeeds if the site is not yet initialized and there are no users yet. It doesn't
		// allow signups after those conditions become true, so we don't need to check the builtin auth
		// provider's allowSignup in site config.
		handleSignUp(db, w, r, true)
	}
}

// checkEmailAbuse performs abuse prevention checks to prevent email abuse, i.e. users using emails
// of other people whom they want to annoy.
func checkEmailAbuse(ctx context.Context, db database.DB, addr string) (abused bool, reason string, err error) {
	email, err := db.UserEmails().GetLatestVerificationSentEmail(ctx, addr)
	if err != nil {
		if errcode.IsNotFound(err) {
			return false, "", nil
		}
		return false, "", err
	}

	// NOTE: We could check if email is already used here but that complicates the logic
	// and the reused problem should be better handled in the user creation.

	if email.NeedsVerificationCoolDown() {
		return true, "too frequent attempt since last verification email sent", nil
	}

	return false, "", nil
}

// doServeSignUp is called to create a new user account. It is called for the normal user signup process (where a
// non-admin user is created) and for the site initialization process (where the initial site admin user account is
// created).
//
// 🚨 SECURITY: Any change to this function could introduce security exploits
// and/or break sign up / initial admin account creation. Be careful.
func handleSignUp(db database.DB, w http.ResponseWriter, r *http.Request, failIfNewUserIsNotInitialSiteAdmin bool) {
	if r.Method != "POST" {
		http.Error(w, fmt.Sprintf("unsupported method %s", r.Method), http.StatusBadRequest)
		return
	}
	var creds credentials
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "could not decode request body", http.StatusBadRequest)
		return
	}

	const defaultErrorMessage = "Signup failed unexpectedly."

	if err := suspiciousnames.CheckNameAllowedForUserOrOrganization(creds.Username); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Create the user.
	//
	// We don't need to check the builtin auth provider's allowSignup because we assume the caller
	// of doServeSignUp checks it, or else that failIfNewUserIsNotInitialSiteAdmin == true (in which
	// case the only signup allowed is that of the initial site admin).
	newUserData := database.NewUser{
		Email:                 creds.Email,
		Username:              creds.Username,
		Password:              creds.Password,
		FailIfNotInitialUser:  failIfNewUserIsNotInitialSiteAdmin,
		EnforcePasswordLength: true,
	}
	if failIfNewUserIsNotInitialSiteAdmin {
		// The email of the initial site admin is considered to be verified.
		newUserData.EmailIsVerified = true
	} else {
		code, err := backend.MakeEmailVerificationCode()
		if err != nil {
			log15.Error("Error generating email verification code for new user.", "email", creds.Email, "username", creds.Username, "error", err)
			http.Error(w, defaultErrorMessage, http.StatusInternalServerError)
			return
		}
		newUserData.EmailVerificationCode = code
	}

	// Prevent abuse (users adding emails of other people whom they want to annoy) with the
	// following abuse prevention checks.
	if conf.EmailVerificationRequired() && !newUserData.EmailIsVerified {
		abused, reason, err := checkEmailAbuse(r.Context(), db, creds.Email)
		if err != nil {
			log15.Error("Error checking email abuse", "email", creds.Email, "error", err)
			http.Error(w, defaultErrorMessage, http.StatusInternalServerError)
			return
		} else if abused {
			log15.Error("Possible email address abuse prevented", "email", creds.Email, "reason", reason)
			http.Error(w, "Email address is possibly being abused, please try again later or use a different email address.", http.StatusTooManyRequests)
			return
		}
	}

	usr, err := database.Users(db).Create(r.Context(), newUserData)
	if err != nil {
		var (
			message    string
			statusCode int
		)
		switch {
		case database.IsUsernameExists(err):
			message = "Username is already in use. Try a different username."
			statusCode = http.StatusConflict
		case database.IsEmailExists(err):
			message = "Email address is already in use. Try signing into that account instead, or use a different email address."
			statusCode = http.StatusConflict
		case errcode.PresentationMessage(err) != "":
			message = errcode.PresentationMessage(err)
			statusCode = http.StatusConflict
		default:
			// Do not show non-allowed error messages to user, in case they contain sensitive or confusing
			// information.
			message = defaultErrorMessage
			statusCode = http.StatusInternalServerError
		}
		log15.Error("Error in user signup.", "email", creds.Email, "username", creds.Username, "error", err)
		http.Error(w, message, statusCode)

		if err = usagestats.LogBackendEvent(db, actor.FromContext(r.Context()).UID, deviceid.FromContext(r.Context()), "SignUpFailed", nil, nil, featureflag.FromContext(r.Context()), nil); err != nil {
			log15.Warn("Failed to log event SignUpFailed", "error", err)
		}

		return
	}

	if err = database.Authz(db).GrantPendingPermissions(r.Context(), &database.GrantPendingPermissionsArgs{
		UserID: usr.ID,
		Perm:   authz.Read,
		Type:   authz.PermRepos,
	}); err != nil {
		log15.Error("Failed to grant user pending permissions", "userID", usr.ID, "error", err)
	}

	if conf.EmailVerificationRequired() && !newUserData.EmailIsVerified {
		if err := backend.SendUserEmailVerificationEmail(r.Context(), usr.Username, creds.Email, newUserData.EmailVerificationCode); err != nil {
			log15.Error("failed to send email verification (continuing, user's email will be unverified)", "email", creds.Email, "err", err)
		} else if err = database.UserEmails(db).SetLastVerification(r.Context(), usr.ID, creds.Email, newUserData.EmailVerificationCode); err != nil {
			log15.Error("failed to set email last verification sent at (user's email is verified)", "email", creds.Email, "err", err)
		}
	}

	// Write the session cookie
	a := &actor.Actor{UID: usr.ID}
	if err := session.SetActor(w, r, a, 0, usr.CreatedAt); err != nil {
		httpLogAndError(w, "Could not create new user session", http.StatusInternalServerError)
	}

	// Track user data
	if r.UserAgent() != "Sourcegraph e2etest-bot" {
		go hubspotutil.SyncUser(creds.Email, hubspotutil.SignupEventID, &hubspot.ContactProperties{AnonymousUserID: creds.AnonymousUserID, FirstSourceURL: creds.FirstSourceURL, DatabaseID: usr.ID})
	}

	if err = usagestats.LogBackendEvent(db, actor.FromContext(r.Context()).UID, deviceid.FromContext(r.Context()), "SignUpSucceeded", nil, nil, featureflag.FromContext(r.Context()), nil); err != nil {
		log15.Warn("Failed to log event SignUpSucceeded", "error", err)
	}
}

func getByEmailOrUsername(ctx context.Context, db dbutil.DB, emailOrUsername string) (*types.User, error) {
	if strings.Contains(emailOrUsername, "@") {
		return database.Users(db).GetByVerifiedEmail(ctx, emailOrUsername)
	}
	return database.Users(db).GetByUsername(ctx, emailOrUsername)
}

// HandleSignIn accepts a POST containing username-password credentials and authenticates the
// current session if the credentials are valid.
func HandleSignIn(db database.DB) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if handleEnabledCheck(w) {
			return
		}

		var usr types.User
		var actor actor.Actor

		var signInResult = database.SecurityEventNameSignInAttempted
		logSignInEvent(r, db, &usr, &signInResult)

		// We have more failure scenarios and ONLY one successful scenario. By default
		// assume a SigninFailed state so that the deferred logSignInEvent function call
		// will log the correct security event in case of a failure.
		signInResult = database.SecurityEventNameSignInFailed
		defer logSignInEvent(r, db, &usr, &signInResult)

		ctx := r.Context()

		if r.Method != "POST" {
			http.Error(w, fmt.Sprintf("Unsupported method %s", r.Method), http.StatusBadRequest)
			return
		}
		var creds credentials
		if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
			http.Error(w, "Could not decode request body", http.StatusBadRequest)
			return
		}

		// Validate user. Allow login by both email and username (for convenience).
		u, err := getByEmailOrUsername(ctx, db, creds.Email)
		if err != nil {
			httpLogAndError(w, "Authentication failed", http.StatusUnauthorized, "err", err)
			return
		}
		usr = *u

		// 🚨 SECURITY: check password
		correct, err := database.Users(db).IsPassword(ctx, usr.ID, creds.Password)
		if err != nil {
			httpLogAndError(w, "Error checking password", http.StatusInternalServerError, "err", err)
			return
		}
		if !correct {
			httpLogAndError(w, "Authentication failed", http.StatusUnauthorized)
			return
		}

		actor.UID = usr.ID

		// Write the session cookie
		if err := session.SetActor(w, r, &actor, 0, usr.CreatedAt); err != nil {
			httpLogAndError(w, "Could not create new user session", http.StatusInternalServerError)
			return
		}

		signInResult = database.SecurityEventNameSignInSucceeded
	}
}

func logSignInEvent(r *http.Request, db database.DB, usr *types.User, name *database.SecurityEventName) {
	var anonymousID string
	event := &database.SecurityEvent{
		Name:            *name,
		URL:             r.URL.Path,
		UserID:          uint32(usr.ID),
		AnonymousUserID: anonymousID,
		Source:          "BACKEND",
		Timestamp:       time.Now(),
	}

	// Safe to ignore this error
	event.AnonymousUserID, _ = cookie.AnonymousUID(r)
	usagestats.LogBackendEvent(db, usr.ID, deviceid.FromContext(r.Context()), string(*name), nil, nil, featureflag.FromContext(r.Context()), nil)
	database.SecurityEventLogs(db).LogEvent(r.Context(), event)
}

// HandleCheckUsernameTaken checks availability of username for signup form
func HandleCheckUsernameTaken(db dbutil.DB) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		username, err := auth.NormalizeUsername(vars["username"])

		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		_, err = database.Namespaces(db).GetByName(r.Context(), username)
		if err == database.ErrNamespaceNotFound {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if err != nil {
			httpLogAndError(w, "Error checking username uniqueness", http.StatusInternalServerError, "err", err)
			return
		}

		w.WriteHeader(http.StatusOK)
	}
}

func httpLogAndError(w http.ResponseWriter, msg string, code int, errArgs ...interface{}) {
	log15.Error(msg, errArgs...)
	http.Error(w, msg, code)
}
