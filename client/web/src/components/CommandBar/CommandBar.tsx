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

export const CommandBar = ({ authenticatedUser }: Props) => {
    const history = useHistory()

    const { repoName } = parseBrowserRepoURL(location.pathname + location.search + location.hash)

    useEffect((): void => {
        window.CommandBar.boot('command-user')
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
    }, [history])

    useEffect(() => {
        window.CommandBar.addCallback('goToFile', ({ file }: { file: FormattedFileSearchMatch }) => {
            history.push(`/${repoName}/-/blob/${file.path}`)
        })
    }, [history, repoName])

    useEffect(() => {
        const repo = repoName.replace('.', '\\.')

        window.CommandBar.addContext('files', [], {
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
