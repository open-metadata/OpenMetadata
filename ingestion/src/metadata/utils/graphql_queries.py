DAGSTER_PIPELINE_DETAILS_GRAPHQL = """
            query AssetNodeQuery {
            assetNodes {
                __typename
                ... on AssetNode {
                    id
                    jobNames
                    groupName
                    graphName
                    opName
                    opNames
                    jobs{
                        id
                        name
                        description
                        runs{
                            id
                            runId
                            status
                            stats{
                                    ... on RunStatsSnapshot {
                                            startTime
                                            endTime
                                            stepsFailed
                                        }
                                }
                    
                        }
                    }
                
                
                    }
                }
            }
        """


TEST_QUERY_GRAPHQL = """query Pipeline {
            pipelineRunsOrError {
                __typename
                ... on PipelineRuns {
                results {
                    assetSelection {
                    path
                    }
                    runId
                    status
                }
                }
            }
            }"""
