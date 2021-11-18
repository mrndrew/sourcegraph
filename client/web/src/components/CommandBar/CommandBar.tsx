import { CommandBarClientSDK } from 'commandbar'
import { useEffect } from 'react'
import { useHistory } from 'react-router'

import { AuthenticatedUser } from '../../auth'
import { parseBrowserRepoURL } from '../../util/url'

import {
    addFilesContext,
    addGoToExtensionsCommand,
    addGoToRepositoriesCommand,
    addGoToSavedSearchesCommand,
    addGoToSettingsCommand,
    addOpenFileCommand,
    bootCommandBar,
    shutDownCommandBar,
} from './commandbarSetup'

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

    useEffect(() => {
        bootCommandBar()

        return () => {
            shutDownCommandBar()
        }
    }, [])

    useEffect(() => {
        addGoToExtensionsCommand(history)
        addGoToSettingsCommand(history, authenticatedUser)
        addGoToRepositoriesCommand(history, authenticatedUser)
        addGoToSavedSearchesCommand(history, authenticatedUser)
    }, [history])

    useEffect(() => {
        addOpenFileCommand(history, repoName)
    }, [history, repoName])

    useEffect(() => {
        const repo = repoName.replace('.', '\\.')

        addFilesContext(repo)
    }, [repoName])

    return null
}
