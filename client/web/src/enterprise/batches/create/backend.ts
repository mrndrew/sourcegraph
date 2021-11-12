import { gql } from '@sourcegraph/shared/src/graphql/graphql'

export const EXECUTE_BATCH_SPEC = gql`
    mutation ExecuteBatchSpec($batchSpec: ID!) {
        executeBatchSpec(batchSpec: $batchSpec) {
            id
            namespace {
                url
            }
        }
    }
`

export const CREATE_BATCH_SPEC_FROM_RAW = gql`
    mutation CreateBatchSpecFromRaw($spec: String!, $namespace: ID!) {
        createBatchSpecFromRaw(batchSpec: $spec, namespace: $namespace) {
            id
        }
    }
`

export const REPLACE_BATCH_SPEC_INPUT = gql`
    mutation ReplaceBatchSpecInput($previousSpec: ID!, $spec: String!) {
        replaceBatchSpecInput(previousSpec: $previousSpec, batchSpec: $spec) {
            id
        }
    }
`

export const WORKSPACE_RESOLUTION_STATUS = gql`
    query WorkspaceResolutionStatus($batchSpec: ID!) {
        node(id: $batchSpec) {
            __typename
            ... on BatchSpec {
                workspaceResolution {
                    state
                    failureMessage
                }
            }
        }
    }
`

export const WORKSPACES_AND_IMPORTING_CHANGESETS = gql`
    query WorkspacesAndImportingChangesets($batchSpec: ID!) {
        node(id: $batchSpec) {
            __typename
            ... on BatchSpec {
                workspaceResolution {
                    workspaces(first: 10000) {
                        nodes {
                            ...PreviewBatchSpecWorkspaceFields
                        }
                    }
                }
                importingChangesets(first: 10000) {
                    totalCount
                    nodes {
                        __typename
                        ... on VisibleChangesetSpec {
                            ...PreviewBatchSpecImportingChangesetFields
                        }
                    }
                }
            }
        }
    }

    fragment PreviewBatchSpecWorkspaceFields on BatchSpecWorkspace {
        repository {
            id
            name
            url
        }
        ignored
        unsupported
        branch {
            id
            abbrevName
            displayName
            target {
                oid
            }
        }
        path
        searchResultPaths
        cachedResultFound
    }

    fragment PreviewBatchSpecImportingChangesetFields on VisibleChangesetSpec {
        id
        description {
            __typename
            ... on ExistingChangesetReference {
                baseRepository {
                    name
                    url
                }
                externalID
            }
        }
    }
`
