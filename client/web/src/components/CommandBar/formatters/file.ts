import { SearchMatch, PathMatch } from '@sourcegraph/shared/src/search/stream'

export interface FormattedFileSearchMatch {
    name: string
    path: string
    __breadcrumbs: string
}

export const formatFile = (file: SearchMatch): FormattedFileSearchMatch => {
    const { path } = file as PathMatch
    const name = path.split('/').reverse()[0]

    return {
        name,
        path,
        __breadcrumbs: path,
    }
}
