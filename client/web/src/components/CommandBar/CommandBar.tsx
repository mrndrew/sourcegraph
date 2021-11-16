import { CommandBarClientSDK } from 'commandbar'
import { useEffect } from 'react'
import { useHistory } from 'react-router'
import { map, take } from 'rxjs/operators'

import { appendContextFilter } from '@sourcegraph/shared/src/search/query/transformer'
import { fetchStreamSuggestions } from '@sourcegraph/shared/src/search/suggestions'

import { AuthenticatedUser } from '../../auth'
import { parseBrowserRepoURL } from '../../util/url'

import { formatFile, FormattedFileSearchMatch } from './formatters/file'

declare global {
    interface Window {
        CommandBar: CommandBarClientSDK
    }
}

interface Props {
    authenticatedUser: AuthenticatedUser
}

const addCommands = (): void => {
    window.CommandBar.addCommand({
        text: 'Open file',
        name: 'open_file',
        arguments: {
            file: {
                type: 'context',
                value: 'files',
                order_key: 1,
                label: 'Select from the list below',
                id: 'Z6iUKqXDTa4LRaV4imgNx',
            },
        },
        template: {
            type: 'callback',
            value: 'goToFile',
            operation: 'self',
        },
    })

    window.CommandBar.addCommand({
        text: 'Go to Extensions',
        name: 'go_to_extensions',
        arguments: {},
        template: {
            type: 'callback',
            value: 'goToExtensions',
            operation: 'router',
        },
    })

    window.CommandBar.addCommand({
        text: 'Go to Settings',
        name: 'go_to_settings',
        arguments: {},
        template: {
            type: 'callback',
            value: 'goToSettings',
            operation: 'router',
        },
    })

    window.CommandBar.addCommand({
        text: 'Go to Repositories',
        name: 'go_to_repositories',
        arguments: {},
        template: {
            type: 'callback',
            value: 'goToRepositories',
            operation: 'router',
        },
    })

    window.CommandBar.addCommand({
        text: 'Go to Saved Searches',
        name: 'go_to_saved_searches',
        arguments: {},
        template: {
            type: 'callback',
            value: 'goToSavedSearches',
            operation: 'router',
        },
    })
}

export const CommandBar = ({ authenticatedUser }: Props) => {
    const history = useHistory()

    const { repoName } = parseBrowserRepoURL(location.pathname + location.search + location.hash)

    useEffect((): void => {
        window.CommandBar.boot('command-user')
        addCommands()
    }, [])

    useEffect(() => {
        const routerFunc = (newUrl: string): void => {
            history.push(newUrl)
        }
        window.CommandBar.addRouter(routerFunc)
    }, [history])

    useEffect(() => {
        window.CommandBar.addCallback('goToSettings', () => {
            history.push(`${authenticatedUser.url}/settings`)
        })

        window.CommandBar.addCallback('goToRepositories', () => {
            history.push(`${authenticatedUser.url}/settings/repositories`)
        })

        window.CommandBar.addCallback('goToSavedSearches', () => {
            history.push(`${authenticatedUser.url}/searches`)
        })

        window.CommandBar.addCallback('goToExtensions', () => {
            history.push('/extensions')
        })
    }, [history])

    useEffect(() => {
        window.CommandBar.addCallback('goToFile', ({ file }: { file: FormattedFileSearchMatch }) => {
            history.push(`/${repoName}/-/blob/${file.path}`)
        })
    }, [history, repoName])

    useEffect(() => {
        const repo = repoName.replace('.', '\\.')

        window.CommandBar.addContext('files', [], {
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
    }, [repoName])

    return null
}
