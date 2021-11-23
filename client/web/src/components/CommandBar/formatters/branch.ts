import { GitRefFields } from '../../../graphql-operations'

export interface FormattedBranchSearchMatch {
    name: string
    url: string
}

export const formatBranch = (branch: GitRefFields): FormattedBranchSearchMatch => {
    const { displayName, url } = branch

    return {
        url,
        name: displayName,
    }
}
