import { CommandBarClientSDK } from 'commandbar'
import { useEffect } from 'react'
import { useHistory } from 'react-router'

import { AuthenticatedUser } from '../../auth'

import {
    addCopyPermalinkCommand,
    addGoToExtensionsCommand,
    addGoToRepositoriesCommand,
    addGoToSavedSearchesCommand,
    addGoToSettingsCommand,
    addOpenFileCommand,
    addOpenQuickLinkCommand,
    bootCommandBar,
    setHistory,
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

    useEffect(() => {
        bootCommandBar()
        setHistory(history)

        addGoToExtensionsCommand(history)
        addGoToSettingsCommand(history, authenticatedUser)
        addGoToRepositoriesCommand(history, authenticatedUser)
        addGoToSavedSearchesCommand(history, authenticatedUser)
        addCopyPermalinkCommand()
        addOpenFileCommand()
        addOpenQuickLinkCommand()

        return () => {
            shutDownCommandBar()
        }
    }, [])

    return null
}
