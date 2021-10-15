import { Optional } from 'utility-types'

// import { SectionID } from '../../search/results/sidebar/SearchSidebar'

/**
 * Schema for temporary settings.
 */
export interface TemporarySettingsSchema {
    // TODO(tj): move sidebar types and sections to shared
    // 'search.collapsedSidebarSections': { [key in SectionID]?: boolean }
    'search.collapsedSidebarSections': Record<string, boolean | undefined>
    'search.sidebar.revisions.tab': number
    'search.onboarding.tourCancelled': boolean
    'search.usedNonGlobalContext': boolean
    'insights.freeBetaAccepted': boolean
    'npsSurvey.hasTemporarilyDismissed': boolean
    'npsSurvey.hasPermanentlyDismissed': boolean
    'user.lastDayActive': string | null
    'user.daysActiveCount': number
    'signup.finishedWelcomeFlow': boolean
}

/**
 * All temporary setttings are possibly undefined. This is the actual schema that
 * should be used to force the consumer to check for undefined values.
 */
export type TemporarySettings = Optional<TemporarySettingsSchema>
