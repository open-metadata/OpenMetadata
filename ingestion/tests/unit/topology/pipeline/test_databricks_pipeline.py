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
    StatusType,
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
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.databrickspipeline.metadata import (
    DatabrickspipelineSource,
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
    mock_history_data: dict = json.load(file)


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
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.DatabricksPipeline,
)

MOCK_PIPELINE = Pipeline(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="606358633757175",
    fullyQualifiedName="databricks_pipeline_source.606358633757175",
    displayName="OpenMetadata Databricks Workflow",
    tasks=[
        Task(
            name="task_1",
            displayName="task_1",
            taskType="notebook_task",
            downstreamTasks=["task_2", "task_3", "task_4"],
        ),
        Task(
            name="task_2",
            displayName="task_2",
            taskType="spark_python_task",
            downstreamTasks=[],
        ),
        Task(
            name="task_3",
            displayName="task_3",
            taskType="python_wheel_task",
            downstreamTasks=["task_5"],
        ),
        Task(
            name="task_4",
            displayName="task_4",
            taskType="pipeline_task",
            downstreamTasks=["task_5"],
        ),
        Task(
            name="task_5",
            displayName="task_5",
            taskType="sql_task",
            downstreamTasks=[],
        ),
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)

EXPECTED_CREATED_PIPELINES = CreatePipelineRequest(
    name="606358633757175",
    displayName="OpenMetadata Databricks Workflow",
    description="OpenMetadata Databricks Workflow",
    tasks=[
        Task(
            name="task_1",
            displayName="task_1",
            taskType="notebook_task",
            downstreamTasks=["task_2", "task_3", "task_4"],
        ),
        Task(
            name="task_2",
            displayName="task_2",
            taskType="spark_python_task",
            downstreamTasks=[],
        ),
        Task(
            name="task_3",
            displayName="task_3",
            taskType="python_wheel_task",
            downstreamTasks=["task_5"],
        ),
        Task(
            name="task_4",
            displayName="task_4",
            taskType="pipeline_task",
            downstreamTasks=["task_5"],
        ),
        Task(
            name="task_5",
            displayName="task_5",
            taskType="sql_task",
            downstreamTasks=[],
        ),
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)


EXPECTED_PIPELINE_STATUS = [
    OMetaPipelineStatus(
        pipeline_fqn="databricks_pipeline_source.606358633757175",
        pipeline_status=PipelineStatus(
            executionStatus=StatusType.Successful.value,
            taskStatus=[
                TaskStatus(
                    name="one_task",
                    executionStatus=StatusType.Successful.value,
                    startTime=1672691730568,
                    endTime=1672691793559,
                    logLink="https://workspace.azuredatabricks.net/?o=workspace_id#job/325697581681107/run/821029",
                )
            ],
            timestamp=1672691730552,
        ),
    ),
    OMetaPipelineStatus(
        pipeline_fqn="databricks_pipeline_source.606358633757175",
        pipeline_status=PipelineStatus(
            executionStatus=StatusType.Failed.value,
            taskStatus=[
                TaskStatus(
                    name="one_task",
                    executionStatus=StatusType.Failed.value,
                    startTime=1672691610544,
                    endTime=1672691677696,
                    logLink="https://workspace.azuredatabricks.net/?o=workspace_id#job/325697581681107/run/820956",
                )
            ],
            timestamp=1672691610525,
        ),
    ),
]


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
        config = OpenMetadataWorkflowConfig.parse_obj(mock_databricks_config)

        self.databricks = DatabrickspipelineSource.create(
            mock_databricks_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.databricks.context.__dict__["pipeline"] = MOCK_PIPELINE
        self.databricks.context.__dict__["pipeline_service"] = MOCK_PIPELINE_SERVICE
        self.databricks.context.__dict__["job_id_list"] = [
            mock_history_data[0]["job_id"]
        ]

    @patch(
        "metadata.ingestion.source.database.databricks.client.DatabricksClient.list_jobs"
    )
    def test_get_pipelines_list(self, list_jobs):
        list_jobs.return_value = mock_data
        results = list(self.databricks.get_pipelines_list())
        self.assertEqual(mock_data, results)

    def test_yield_pipeline(self):
        pipelines = list(self.databricks.yield_pipeline(mock_data[0]))[0]
        self.assertEqual(pipelines, EXPECTED_CREATED_PIPELINES)

    @patch(
        "metadata.ingestion.source.database.databricks.client.DatabricksClient.get_job_runs"
    )
    def test_yield_pipeline_status(self, get_job_runs):
        get_job_runs.return_value = mock_history_data
        pipeline_status = list(
            self.databricks.yield_pipeline_status(mock_history_data[0]["job_id"])
        )
        self.assertEqual(pipeline_status, EXPECTED_PIPELINE_STATUS)
