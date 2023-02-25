"""
Test Domo Dashboard using the topology
"""

import json
from datetime import datetime, timezone
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
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.domopipeline.metadata import DomopipelineSource

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/domopipeline_dataset.json"
)
with open(mock_file_path, encoding="UTF-8") as file:
    mock_data: dict = json.load(file)

MOCK_PIPELINE_SERVICE = PipelineService(
    id="86ff3c40-7c51-4ff5-9727-738cead28d9a",
    name="domopipeline_source_test",
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.DomoPipeline,
)

MOCK_PIPELINE = Pipeline(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="do_it_all_with_default_config",
    fullyQualifiedName="local_domo_pipeline.1",
    displayName="do_it_all_with_default_config",
    description="",
    tasks=[
        Task(
            name="a58b1856-729c-493b-bc87-6d2269b43ec0",
            displayName="do_it_all_with_default_config",
            description="",
            taskUrl="",
        )
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)

mock_domopipeline_config = {
    "source": {
        "type": "domopipeline",
        "serviceName": "test2",
        "serviceConnection": {
            "config": {
                "type": "DomoPipeline",
                "clientId": "00000",
                "secretToken": "abcdefg",
                "accessToken": "accessTpokem",
                "apiHost": "api.domo.com",
                "sandboxDomain": "https://domain.domo.com",
            }
        },
        "sourceConfig": {
            "config": {"dashboardFilterPattern": {}, "chartFilterPattern": {}}
        },
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


EXPECTED_PIPELINE_STATUS = [
    OMetaPipelineStatus(
        pipeline_fqn="local_domo_pipeline.1",
        pipeline_status=PipelineStatus(
            timestamp=1665476792,
            executionStatus="Successful",
            taskStatus=[
                TaskStatus(
                    name="1",
                    executionStatus="Successful",
                    startTime=1665476783,
                    endTime=1665476792,
                    logLink=None,
                )
            ],
        ),
    ),
    OMetaPipelineStatus(
        pipeline_fqn="local_domo_pipeline.1",
        pipeline_status=PipelineStatus(
            timestamp=1665470252,
            executionStatus="Successful",
            taskStatus=[
                TaskStatus(
                    name="1",
                    executionStatus="Successful",
                    startTime=1665470244,
                    endTime=1665470252,
                    logLink=None,
                )
            ],
        ),
    ),
    OMetaPipelineStatus(
        pipeline_fqn="local_domo_pipeline.1",
        pipeline_status=PipelineStatus(
            timestamp=1665148827,
            executionStatus="Successful",
            taskStatus=[
                TaskStatus(
                    name="1",
                    executionStatus="Successful",
                    startTime=1665148818,
                    endTime=1665148827,
                    logLink=None,
                )
            ],
        ),
    ),
]

EXPECTED_PIPELINE = [
    CreatePipelineRequest(
        name="1",
        displayName="Nihar Dataflows",
        description="THis is description for Nihar dataflow",
        pipelineUrl=None,
        concurrency=None,
        pipelineLocation=None,
        startDate=datetime(2022, 10, 7, 13, 20, 16, tzinfo=timezone.utc),
        tasks=[
            Task(
                name="1",
                displayName="Nihar Dataflows",
                fullyQualifiedName=None,
                description="THis is description for Nihar dataflow",
                taskUrl=None,
                downstreamTasks=None,
                taskType=None,
                taskSQL=None,
                startDate=None,
                endDate=None,
                tags=None,
            )
        ],
        tags=None,
        owner=None,
        service="domopipeline_source_test",
        extension=None,
    )
]

MOCK_PIPELINE_DETAILS = {
    "id": 1,
    "name": "Nihar Dataflows",
    "description": "THis is description for Nihar dataflow",
    "dapDataFlowId": "06996c5f-20ec-4814-8309-2aeb8028875f",
    "responsibleUserId": 1027954122,
    "runState": "ENABLED",
    "lastExecution": {
        "id": 3,
        "onboardFlowId": 1,
        "previewRows": 0,
        "dapDataFlowExecutionId": "9cc03a9d-124b-491e-8579-657fc51d497e",
        "beginTime": 1665476783000,
        "endTime": 1665476792000,
        "lastUpdated": 1665476792000,
        "failed": False,
        "state": "SUCCESS",
        "dataFlowVersion": 0,
    },
    "created": 1665148816000,
    "modified": 1665470784000,
    "engineProperties": {"kettle.mode": "STRICT"},
    "inputs": [
        {
            "dataSourceId": "2e41e76b-fc02-480d-a932-91bdbea40fe5",
            "executeFlowWhenUpdated": False,
            "dataSourceName": "Milan Datasets",
        }
    ],
    "outputs": [
        {
            "onboardFlowId": None,
            "dataSourceId": "dedf9fe6-2544-44b6-9129-d5c313b0ec67",
            "dataSourceName": "Milan Output",
            "versionChainType": "REPLACE",
        }
    ],
    "executionCount": 3,
    "executionSuccessCount": 3,
    "hydrationState": "DEHYDRATED",
    "useLegacyTriggerBehavior": False,
    "passwordProtected": False,
    "deleted": False,
    "abandoned": False,
    "neverAbandon": False,
    "paused": False,
    "magic": True,
    "restricted": False,
    "editable": True,
    "enabled": True,
    "container": False,
    "databaseType": "MAGIC",
    "triggeredByInput": False,
    "draft": False,
    "numInputs": 1,
    "numOutputs": 1,
}


class DomoPipelineUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Domo Pipeline Unit Test
    """

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    @patch("pydomo.Domo")
    def __init__(self, methodName, domo_client, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        domo_client.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_domopipeline_config)
        self.domopipeline = DomopipelineSource.create(
            mock_domopipeline_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.domopipeline.context.__dict__["pipeline"] = MOCK_PIPELINE
        self.domopipeline.context.__dict__["pipeline_service"] = MOCK_PIPELINE_SERVICE

    @patch("metadata.clients.domo_client.DomoClient.get_runs")
    def test_pipeline(self, get_runs):
        get_runs.return_value = mock_data
        results = self.domopipeline.yield_pipeline(MOCK_PIPELINE_DETAILS)
        pipeline_list = []
        for result in results:
            if isinstance(result, CreatePipelineRequest):
                pipeline_list.append(result)
        for _, (expected, original) in enumerate(zip(EXPECTED_PIPELINE, pipeline_list)):
            self.assertEqual(expected, original)

    @patch("metadata.clients.domo_client.DomoClient.get_runs")
    def test_yield_pipeline_status(self, get_runs):
        get_runs.return_value = mock_data
        pipeline_status_list = []
        results = self.domopipeline.yield_pipeline_status(MOCK_PIPELINE_DETAILS)
        for result in results:
            if isinstance(result, OMetaPipelineStatus):
                pipeline_status_list.append(result)

        for _, (expected, original) in enumerate(
            zip(EXPECTED_PIPELINE_STATUS, pipeline_status_list)
        ):
            self.assertEqual(expected, original)
