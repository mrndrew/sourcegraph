package webhooks

import (
	"context"
	"testing"

	"github.com/cockroachdb/errors"
	mockassert "github.com/derision-test/go-mockgen/testutil/assert"
	"github.com/stretchr/testify/assert"

	"github.com/sourcegraph/sourcegraph/internal/database/dbmock"
)

func TestHandler(t *testing.T) {
	t.Run("store error", func(t *testing.T) {
		want := errors.New("error")
		store := dbmock.NewMockWebhookLogStore()
		store.DeleteStaleFunc.SetDefaultReturn(want)

		ph := &handler{
			store: store,
		}

		err := ph.Handle(context.Background())
		assert.ErrorIs(t, err, want)
		mockassert.CalledOnce(t, store.DeleteStaleFunc)
	})

	t.Run("success", func(t *testing.T) {
		store := dbmock.NewMockWebhookLogStore()
		ph := &handler{
			store: store,
		}

		err := ph.Handle(context.Background())
		assert.Nil(t, err)
		mockassert.CalledOnce(t, store.DeleteStaleFunc)
	})
}
