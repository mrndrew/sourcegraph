import * as H from 'history'
import { map, take } from 'rxjs/operators'

import { appendContextFilter } from '@sourcegraph/shared/src/search/query/transformer'
import { fetchStreamSuggestions } from '@sourcegraph/shared/src/search/suggestions'

import { AuthenticatedUser } from '../../auth'
import { QuickLink } from '../../schema/settings.schema'

import { ContextKeys } from './contextKeys'
import { formatFile, FormattedFileSearchMatch } from './formatters/file'

let history: H.History | undefined

export const setHistory = (historyObject: H.History) => {
    history = historyObject
}

/**
 * Boot up CommandBar with the user identified.
 *
 * Documentation: https://www.commandbar.com/sdk#boot
 */
export const bootCommandBar = (userId: string = 'command-user') => {
    window.CommandBar.boot(userId)
}

/**
 * Make CommandBar unavailable to the user.
 *
 * Documentation: https://www.commandbar.com/sdk#shutdown
 */
export const shutDownCommandBar = () => {
    window.CommandBar.shutdown()
}

/**
 * Setup context
 * Context is a store that lives on the browser
 * Data passed to context can be used to customize commands. All data stays local.
 *
 * Documentation: https://www.commandbar.com/docs/context/overview
 */
export const addFilesContext = (repoName: string) => {
    const repo = repoName.replace('.', '\\.')

    window.CommandBar.addContext(ContextKeys.Files, [], {
        renderOptions: {
            labelKey: 'name',
        },
        quickFindOptions: {
            quickFind: true,
        },
        searchOptions: {
            searchFunction: (query: string): any => {
                const fullQuery = `repo:^${repo}$ file:${query} type:path count:50`

                return new Promise(resolve => {
                    fetchStreamSuggestions(appendContextFilter(fullQuery, undefined))
                        .pipe(
                            map(files => files.map(formatFile)),
                            take(1)
                        )
                        .subscribe(resolve)
                })
            },
        },
    })
}

export const removeFilesContext = () => {
    window.CommandBar.removeContext(ContextKeys.Files)
}

/**
 * Setup commands
 */
export const addOpenFileCommand = () => {
    /**
     * Commands are function that can be executed by selecting them in CommandBar or by shortcut if it's defined
     *
     * Documentation: https://www.commandbar.com/docs/commands/overview
     */
    window.CommandBar.addCommand({
        text: 'Open file',
        name: 'open_file',
        arguments: {
            file: {
                type: 'context',
                value: 'files',
                order_key: 1,
                label: 'Select from the list below',
            },
        },
        template: {
            type: 'callback',
            value: ContextKeys.GoToFile,
            operation: 'self',
        },
    })
}

export const addOpenFileCallback = (history: H.History, repoName: string) => {
    /**
     * Callbacks are functions that are triggered when users select commands.
     *
     * Documentation: https://www.commandbar.com/docs/commands/actions/callback
     */
    window.CommandBar.addCallback(ContextKeys.GoToFile, ({ file }: { file: FormattedFileSearchMatch }) => {
        history.push(`/${repoName}/-/blob/${file.path}`)
    })
}

export const removeOpenFileCallback = () => {
    window.CommandBar.removeCallback(ContextKeys.GoToFile)
}

export const addGoToExtensionsCommand = (history: H.History) => {
    window.CommandBar.addCallback(ContextKeys.GoToExtensions, () => {
        history.push('/extensions')
    })

    window.CommandBar.addCommand({
        text: 'Go to Extensions',
        name: 'go_to_extensions',
        arguments: {},
        template: {
            type: 'callback',
            value: ContextKeys.GoToExtensions,
            operation: 'router',
        },
    })
}

export const addGoToSettingsCommand = (history: H.History, authenticatedUser: AuthenticatedUser) => {
    window.CommandBar.addCallback(ContextKeys.GoToSettings, () => {
        history.push(`${authenticatedUser.url}/settings`)
    })

    window.CommandBar.addCommand({
        text: 'Go to Settings',
        name: 'go_to_settings',
        arguments: {},
        template: {
            type: 'callback',
            value: ContextKeys.GoToSettings,
            operation: 'router',
        },
    })
}

export const addGoToRepositoriesCommand = (history: H.History, authenticatedUser: AuthenticatedUser) => {
    window.CommandBar.addCallback(ContextKeys.GoToRepositories, () => {
        history.push(`${authenticatedUser.url}/settings/repositories`)
    })

    window.CommandBar.addCommand({
        text: 'Go to Repositories',
        name: 'go_to_repositories',
        arguments: {},
        template: {
            type: 'callback',
            value: ContextKeys.GoToRepositories,
            operation: 'router',
        },
    })
}

export const addGoToSavedSearchesCommand = (history: H.History, authenticatedUser: AuthenticatedUser) => {
    window.CommandBar.addCallback(ContextKeys.GoToSavedSearches, () => {
        history.push(`${authenticatedUser.url}/searches`)
    })

    window.CommandBar.addCommand({
        text: 'Go to Saved Searches',
        name: 'go_to_saved_searches',
        arguments: {},
        template: {
            type: 'callback',
            value: ContextKeys.GoToSavedSearches,
            operation: 'router',
        },
    })
}

export const addCopyPermalinkCommand = () => {
    window.CommandBar.addCommand({
        text: 'Copy Repo Permalink',
        name: 'copy_repo_permalink',
        arguments: {},
        template: {
            type: 'callback',
            value: ContextKeys.CopyPermalink,
        },
    })
}

export const addCopyPermalinkCallback = (permalink: string) => {
    window.CommandBar.addCallback(ContextKeys.CopyPermalink, async () => {
        await navigator.clipboard.writeText(permalink)
    })
}

export const removeCopyPermalinkCallback = () => {
    window.CommandBar.removeCallback(ContextKeys.CopyPermalink)
}

export const addOpenQuickLinkCommand = () => {
    window.CommandBar.addCommand({
        text: 'Open quick link',
        name: 'open_quick_link',
        arguments: {
            quickLink: {
                type: 'context',
                value: ContextKeys.QuickLinks,
                order_key: 1,
                label: 'Select from the list below',
            },
        },
        template: {
            type: 'callback',
            value: ContextKeys.GoToQuickLink,
            operation: 'self',
        },
    })
}

export const addQuickLinksContext = (quickLinks: QuickLink[]) => {
    window.CommandBar.addContext(ContextKeys.QuickLinks, quickLinks, {
        renderOptions: {
            labelKey: 'name',
        },
        quickFindOptions: {
            quickFind: true,
        },
        searchOptions: {
            fields: ['name'],
        },
    })
}

export const removeQuickLinksContext = () => {
    window.CommandBar.removeContext(ContextKeys.QuickLinks)
}

export const addOpenQuickLinkCallback = () => {
    window.CommandBar.addCallback(ContextKeys.GoToQuickLink, ({ quickLink }: { quickLink: QuickLink }) => {
        const url = new URL(quickLink.url)

        history?.push(url.pathname + url.search)
    })
}

export const removeOpenQuickLinkCallBack = () => {
    window.CommandBar.removeCallback(ContextKeys.GoToQuickLink)
}

export const addOpenQuickLinksContextAndCallback = (quickLinks: QuickLink[]) => {
    addQuickLinksContext(quickLinks)
    addOpenQuickLinkCallback()
}

export const removeOpenQuickLinksContextAndCallback = () => {
    removeQuickLinksContext()
    removeOpenQuickLinkCallBack()
}
