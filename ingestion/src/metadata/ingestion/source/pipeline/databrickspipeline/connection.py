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
Source connection handler
"""
from functools import partial

from metadata.generated.schema.entity.services.connections.pipeline.databricksPipelineConnection import (
    DatabricksPipelineConnection,
)
from metadata.ingestion.connections.test_connections import (
    TestConnectionResult,
    TestConnectionStep,
    test_connection_steps,
)
from metadata.ingestion.source.database.databricks.client import DatabricksClient


def get_connection(connection: DatabricksPipelineConnection) -> DatabricksClient:
    """
    Create connection
    """
    return DatabricksClient(connection)


def test_connection(client: DatabricksClient, _) -> TestConnectionResult:
    """
    Test connection
    """

    def custom_executor_for_pipeline():
        result = client.list_jobs()
        return list(result)

    def custom_executor_for_pipeline_status():
        jobs = list(client.list_jobs())
        result = client.get_job_runs(jobs[0]["job_id"])
        return list(result)

    steps = [
        TestConnectionStep(
            function=partial(custom_executor_for_pipeline),
            name="Get Pipeline",
        ),
        TestConnectionStep(
            function=partial(custom_executor_for_pipeline_status),
            name="Get Pipeline Status",
        ),
    ]

    return test_connection_steps(steps)
