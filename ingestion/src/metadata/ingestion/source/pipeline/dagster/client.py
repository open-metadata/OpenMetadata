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
Wrapper module of DagsterGraphQLClient client
"""

import traceback
from typing import List, Optional

from dagster_graphql import DagsterGraphQLClient
from gql.transport.requests import RequestsHTTPTransport

from metadata.generated.schema.entity.services.connections.pipeline.dagsterConnection import (
    DagsterConnection,
)
from metadata.ingestion.source.pipeline.dagster.models import (
    DagsterPipeline,
    GraphOrError,
    GraphOrErrorModel,
    Node,
    PipelineOrErrorModel,
    RepositoriesOrErrorModel,
)
from metadata.ingestion.source.pipeline.dagster.queries import (
    DAGSTER_PIPELINE_DETAILS_GRAPHQL,
    GRAPHQL_QUERY_FOR_JOBS,
    GRAPHQL_RUNS_QUERY,
)
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class DagsterClient:
    """
    Wrapper to DagsterGraphQLClient
    """

    def __init__(self, config: DagsterConnection):
        url = clean_uri(config.host)
        self.client = DagsterGraphQLClient(
            url,
            transport=RequestsHTTPTransport(
                url=f"{url}/graphql",
                headers={"Dagster-Cloud-Api-Token": config.token.get_secret_value()}
                if config.token
                else None,
                timeout=config.timeout,
            ),
        )

    def get_run_list(self) -> Optional[List[Node]]:
        """
        List all the pipeline runs
        """
        try:
            result = self.client._execute(  # pylint: disable=protected-access
                DAGSTER_PIPELINE_DETAILS_GRAPHQL
            )
            result = RepositoriesOrErrorModel.model_validate(result)
            return result.repositoriesOrError.nodes
        except ConnectionError as conerr:
            logger.debug(f"Failed due to: {traceback.format_exc()}")
            logger.error(f"Cannot connect to dagster client {conerr}")
        except Exception as exc:
            logger.debug(f"Failed due to: {traceback.format_exc()}")
            logger.error(f"Unable to get dagster run list {exc}")

        return None

    def get_task_runs(
        self,
        job_id: str,
        pipeline_name: str,
        repository_name: str,
        repository_location: str,
    ) -> Optional[DagsterPipeline]:
        """
        Get all the runs details
        """
        try:
            parameters = {
                "handleID": job_id,
                "selector": {
                    "pipelineName": pipeline_name,
                    "repositoryName": repository_name,
                    "repositoryLocationName": repository_location,
                },
            }
            runs = self.client._execute(  # pylint: disable=protected-access
                query=GRAPHQL_RUNS_QUERY, variables=parameters
            )
            runs = PipelineOrErrorModel.model_validate(runs)

            return runs.pipelineOrError
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error while getting runs for {job_id} - {pipeline_name} - {err}"
            )

        return None

    def get_jobs(
        self, pipeline_name, repository_name: str, repository_location: str
    ) -> Optional[GraphOrError]:
        """
        Get all the jobs for a pipeline
        """
        try:
            parameters = {
                "selector": {
                    "graphName": pipeline_name,
                    "repositoryName": repository_name,
                    "repositoryLocationName": repository_location,
                }
            }
            jobs = self.client._execute(  # pylint: disable=protected-access
                query=GRAPHQL_QUERY_FOR_JOBS, variables=parameters
            )
            jobs = GraphOrErrorModel.model_validate(jobs)
            return jobs.graphOrError
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error while getting jobs {pipeline_name} - {err}")

        return None
