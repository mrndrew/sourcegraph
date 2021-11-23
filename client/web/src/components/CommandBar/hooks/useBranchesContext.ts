import { useEffect, useRef, useState } from 'react'

import { createAggregateError } from '@sourcegraph/shared/src/util/errors'
import { useDebounce } from '@sourcegraph/wildcard'

import {
    GitRefFields,
    GitRefType,
    RepositoryGitRefsResult,
    RepositoryGitRefsVariables,
} from '../../../graphql-operations'
import { REPOSITORY_GIT_REFS } from '../../../repo/GitReference'
import { useConnection } from '../../FilteredConnection/hooks/useConnection'
import {
    addBranchesContext,
    addOpenBranchCallback,
    removeBranchesContext,
    removeOpenBranchCallback,
} from '../commandbarSetup'
import { formatBranch, FormattedBranchSearchMatch } from '../formatters/branch'

const BATCH_COUNT = 50

export const useBranchesContext = (repoId: string): void => {
    const [query, setQuery] = useState('')
    const debouncedQuery = useDebounce(query, 200)
    const resolveReference = useRef<
        (value: FormattedBranchSearchMatch[] | PromiseLike<FormattedBranchSearchMatch[]>) => void
    >()

    const searchFunction = (query: string): Promise<FormattedBranchSearchMatch[]> => {
        setQuery(query)

        return new Promise(resolve => {
            resolveReference.current = resolve
        })
    }

    const response = useConnection<RepositoryGitRefsResult, RepositoryGitRefsVariables, GitRefFields>({
        query: REPOSITORY_GIT_REFS,
        variables: {
            query: debouncedQuery,
            first: BATCH_COUNT,
            repo: repoId,
            type: GitRefType.GIT_BRANCH,
            withBehindAhead: false,
        },
        getConnection: ({ data, errors }) => {
            if (!data || !data.node || data.node.__typename !== 'Repository' || !data.node.gitRefs) {
                throw createAggregateError(errors)
            }
            return data.node.gitRefs
        },
        options: {
            fetchPolicy: 'cache-first',
        },
    })

    useEffect(() => {
        addOpenBranchCallback()

        return () => {
            removeOpenBranchCallback()
            removeBranchesContext()
        }
    }, [])

    useEffect(() => {
        addBranchesContext(searchFunction)
    }, [debouncedQuery])

    useEffect(() => {
        const branches = response.connection?.nodes ? response.connection?.nodes.map(formatBranch) : []

        if (resolveReference.current) {
            if (repoId === '') {
                resolveReference.current([])
                return
            }

            if (branches.length > 0) {
                resolveReference.current(branches)
            }
        }
    }, [response, repoId])
}
