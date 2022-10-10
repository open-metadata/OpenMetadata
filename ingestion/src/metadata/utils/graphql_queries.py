#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
GraphQL queries used during ingestion
"""

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
