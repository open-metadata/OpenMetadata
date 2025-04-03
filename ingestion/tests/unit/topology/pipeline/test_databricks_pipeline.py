#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Databricks Pipeline utils tests
"""

import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.databrickspipeline.metadata import (
    DatabrickspipelineSource,
)
from metadata.ingestion.source.pipeline.databrickspipeline.models import (
    DataBrickPipelineDetails,
)
from metadata.utils.logger import log_ansi_encoded_string

mock_file_path = (
    Path(__file__).parent.parent.parent
    / "resources/datasets/databricks_pipeline_resource.json"
)
with open(mock_file_path) as file:
    mock_data: dict = json.load(file)

mock_file_path = (
    Path(__file__).parent.parent.parent
    / "resources/datasets/databricks_pipeline_history.json"
)
with open(mock_file_path) as file:
    mock_run_data: dict = json.load(file)


mock_databricks_config = {
    "source": {
        "type": "DatabricksPipeline",
        "serviceName": "DatabricksPipeline",
        "serviceConnection": {
            "config": {
                "type": "DatabricksPipeline",
                "token": "random_token",
                "hostPort": "localhost:443",
                "connectionArguments": {
                    "http_path": "sql/1.0/endpoints/path",
                },
            }
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE"
                "2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXB"
                "iEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fN"
                "r3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3u"
                "d-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="databricks_pipeline_test",
    fullyQualifiedName=FullyQualifiedEntityName("databricks_pipeline_test"),
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.DatabricksPipeline,
)

MOCK_PIPELINE = Pipeline(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="11223344",
    fullyQualifiedName="databricks_pipeline_test.11223344",
    displayName="OpenMetadata Databricks Workflow",
    tasks=[
        Task(
            name="Orders_Ingest",
            description="Ingests order data",
            sourceUrl="https://my-workspace.cloud.databricks.com/#job/11223344/run/123",
            downstreamTasks=[],
            taskType="SINGLE_TASK",
        ),
        Task(
            name="Match",
            description="Matches orders with user sessions",
            sourceUrl="https://my-workspace.cloud.databricks.com/#job/11223344/run/123",
            downstreamTasks=["Orders_Ingested", "Sessionize"],
            taskType="SINGLE_TASK",
        ),
        Task(
            name="Sessionize",
            description="Extracts session data from events",
            sourceUrl="https://my-workspace.cloud.databricks.com/#job/11223344/run/123",
            downstreamTasks=[],
            taskType="SINGLE_TASK",
        ),
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)

EXPECTED_CREATED_PIPELINES = CreatePipelineRequest(
    name="11223344",
    displayName="OpenMetadata Databricks Workflow",
    description="This job contain multiple tasks that are required to produce the weekly shark sightings report.",
    tasks=[
        Task(
            name="Orders_Ingest",
            description="Ingests order data",
            sourceUrl="https://my-workspace.cloud.databricks.com/#job/11223344/run/123",
            downstreamTasks=[],
            taskType="SINGLE_TASK",
        ),
        Task(
            name="Match",
            description="Matches orders with user sessions",
            sourceUrl="https://my-workspace.cloud.databricks.com/#job/11223344/run/123",
            downstreamTasks=["Orders_Ingested", "Sessionize"],
            taskType="SINGLE_TASK",
        ),
        Task(
            name="Sessionize",
            description="Extracts session data from events",
            sourceUrl="https://my-workspace.cloud.databricks.com/#job/11223344/run/123",
            downstreamTasks=[],
            taskType="SINGLE_TASK",
        ),
    ],
    scheduleInterval="20 30 * * * ?",
    service=FullyQualifiedEntityName(root="databricks_pipeline_test"),
)

EXPECTED_PIPELINE_STATUS = [
    OMetaPipelineStatus(
        pipeline_fqn="databricks_pipeline_test.11223344",
        pipeline_status=PipelineStatus(
            timestamp=1625060460483,
            executionStatus="Successful",
            taskStatus=[
                TaskStatus(
                    name="Orders_Ingest",
                    executionStatus="Successful",
                    startTime=1625060460483,
                    endTime=1625060863413,
                    logLink="https://my-workspace.cloud.databricks.com/#job/11223344/run/123",
                ),
                TaskStatus(
                    name="Match",
                    executionStatus="Successful",
                    startTime=1625060460483,
                    endTime=1625060863413,
                    logLink="https://my-workspace.cloud.databricks.com/#job/11223344/run/123",
                ),
                TaskStatus(
                    name="Sessionize",
                    executionStatus="Successful",
                    startTime=1625060460483,
                    endTime=1625060863413,
                    logLink="https://my-workspace.cloud.databricks.com/#job/11223344/run/123",
                ),
            ],
        ),
    ),
]

PIPELINE_LIST = [DataBrickPipelineDetails(**data) for data in mock_data]


class DatabricksPipelineTests(TestCase):
    """
    Implements the necessary methods to extract
    Databricks Pipeline test
    """

    maxDiff = None

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        log_ansi_encoded_string(message="init")
        test_connection.return_value = False
        config = OpenMetadataWorkflowConfig.model_validate(mock_databricks_config)

        self.databricks = DatabrickspipelineSource.create(
            mock_databricks_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.databricks.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        self.databricks.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root

    @patch(
        "metadata.ingestion.source.database.databricks.client.DatabricksClient.list_jobs"
    )
    # @patch(
    #     "metadata.ingestion.source.database.databricks.client.DatabricksClient.get_job_runs"
    # )
    def test_get_pipelines_list(self, list_jobs):
        list_jobs.return_value = mock_data
        results = list(self.databricks.get_pipelines_list())
        self.assertEqual(PIPELINE_LIST, results)

    @patch(
        "metadata.ingestion.source.database.databricks.client.DatabricksClient.get_job_runs"
    )
    def test_yield_pipeline(self, get_job_runs):
        get_job_runs.return_value = mock_run_data
        pipelines = list(self.databricks.yield_pipeline(PIPELINE_LIST[0]))[0].right
        self.assertEqual(pipelines, EXPECTED_CREATED_PIPELINES)

    @patch(
        "metadata.ingestion.source.database.databricks.client.DatabricksClient.get_job_runs"
    )
    def test_yield_pipeline_status(self, get_job_runs):
        get_job_runs.return_value = mock_run_data
        pipeline_status = [
            either.right
            for either in self.databricks.yield_pipeline_status(
                DataBrickPipelineDetails(**mock_data[0])
            )
        ]
        self.assertEqual(pipeline_status, EXPECTED_PIPELINE_STATUS)
