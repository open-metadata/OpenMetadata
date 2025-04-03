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
Test Spline using the topology
"""
# pylint: disable=line-too-long
import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
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
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.source.pipeline.spline.metadata import SplineSource
from metadata.ingestion.source.pipeline.spline.models import (
    AttributesNames,
    ExecutionDetail,
    ExecutionEvent,
    ExecutionEvents,
    ExecutionPlan,
    Extra,
    Inputs,
    Output,
)
from metadata.ingestion.source.pipeline.spline.utils import parse_jdbc_url
from metadata.utils.constants import DEFAULT_DATABASE, UTF_8

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/spline_dataset.json"
)
with open(mock_file_path, encoding=UTF_8) as file:
    mock_data: dict = json.load(file)

MOCK_SPLINE_UI_URL = "http://localhost:9090"
mock_spline_config = {
    "source": {
        "type": "spline",
        "serviceName": "spline_source",
        "serviceConnection": {
            "config": {
                "type": "Spline",
                "hostPort": "http://localhost:8080",
                "uiHostPort": MOCK_SPLINE_UI_URL,
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
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}
PIPELINE_ID = "3f784e72-5bf7-5704-8828-ae8464fe915b:lhq160w0"
MOCK_PIPELINE_URL = f"{MOCK_SPLINE_UI_URL}/app/events/overview/{PIPELINE_ID}"


EXPECTED_CREATED_PIPELINES = CreatePipelineRequest(
    name=PIPELINE_ID,
    displayName="jdbc postgres ssl app",
    sourceUrl=MOCK_PIPELINE_URL,
    tasks=[
        Task(
            name=PIPELINE_ID,
            displayName="jdbc postgres ssl app",
            sourceUrl=MOCK_PIPELINE_URL,
        )
    ],
    service=FullyQualifiedEntityName("spline_source"),
)

MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="spline_source",
    fullyQualifiedName=FullyQualifiedEntityName("spline_source"),
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.Airbyte,
)

MOCK_PIPELINE = Pipeline(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name=PIPELINE_ID,
    fullyQualifiedName=f"spline_source.{PIPELINE_ID}",
    displayName="MSSQL <> Postgres",
    sourceUrl=MOCK_PIPELINE_URL,
    tasks=[
        Task(
            name=PIPELINE_ID,
            displayName="jdbc postgres ssl app",
            sourceUrl=MOCK_PIPELINE_URL,
        )
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)

EXPECTED_SPLINE_PIPELINES = ExecutionEvents(
    items=[
        ExecutionEvent(
            executionEventId="3f784e72-5bf7-5704-8828-ae8464fe915b:lhq160w0",
            executionPlanId="3f784e72-5bf7-5704-8828-ae8464fe915b",
            applicationName="jdbc postgres ssl app",
        ),
        ExecutionEvent(
            executionEventId="96976f56-9fe3-5bcc-a3e7-ac28781842c9:lhpygcji",
            executionPlanId="96976f56-9fe3-5bcc-a3e7-ac28781842c9",
            applicationName="databricks shell",
        ),
    ],
    totalCount=2,
    pageNum=1,
    pageSize=10,
)

EXPECTED_LINEAGE_DETAILS = ExecutionDetail(
    executionPlan=ExecutionPlan(
        _id="3f784e72-5bf7-5704-8828-ae8464fe915b",
        name="jdbc postgres ssl app",
        inputs=[
            Inputs(
                source="jdbc:postgresql://localhost:5432/postgres?sslmode=disable:spline_demo.start"
            ),
            Inputs(
                source="jdbc:postgresql://localhost:5432/postgres?sslmode=disable:spline_demo.destination"
            ),
        ],
        output=Output(
            source="jdbc:postgresql://localhost:5432/postgres?sslmode=disable:spline_test.filter"
        ),
        extra=Extra(
            attributes=[
                AttributesNames(id="3f784e72-5bf7-5704-8828-ae8464fe915b:attr-1"),
                AttributesNames(id="3f784e72-5bf7-5704-8828-ae8464fe915b:attr-0"),
                AttributesNames(id="3f784e72-5bf7-5704-8828-ae8464fe915b:attr-3"),
                AttributesNames(id="3f784e72-5bf7-5704-8828-ae8464fe915b:attr-2"),
                AttributesNames(id="3f784e72-5bf7-5704-8828-ae8464fe915b:attr-5"),
                AttributesNames(id="3f784e72-5bf7-5704-8828-ae8464fe915b:attr-4"),
            ]
        ),
    )
)

JDBC_PARSING_EXAMPLES = [
    (
        "jdbc:postgresql://localhost:5432/postgres?sslmode=disable:spline_demo.start",
        "postgres",
        "spline_demo",
        "start",
    ),
    (
        "jdbc:postgresql://localhost:5432/postgres?sslmode=disable:spline_demo.destination",
        "postgres",
        "spline_demo",
        "destination",
    ),
    (
        "jdbc:postgresql://localhost:5432/postgres?sslmode=disable:spline_test.filter",
        "postgres",
        "spline_test",
        "filter",
    ),
    (
        "jdbc:postgresql://localhost:5432/postgres?sslmode=disable:filter",
        "postgres",
        None,
        "filter",
    ),
    ("jdbc:oracle:thin:@localhost:1521:test_table", None, None, "test_table"),
    (
        "jdbc:oracle:thin:@localhost:1521:test_schema.test_table",
        None,
        "test_schema",
        "test_table",
    ),
    (
        "jdbc:oracle:thin:@localhost:1521/TESTDB:test_schema.test_table",
        "TESTDB",
        "test_schema",
        "test_table",
    ),
    (
        "jdbc:mysql://localhost:3306/openmetadata_db?allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=UTC",
        DEFAULT_DATABASE,
        "openmetadata_db",
        None,
    ),
    (
        "jdbc:mysql://localhost:3306/openmetadata_db?allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=UTC:filter",
        DEFAULT_DATABASE,
        "openmetadata_db",
        "filter",
    ),
    ("jdbc:hive2://localhost:10000/:test_tbl", DEFAULT_DATABASE, None, "test_tbl"),
    ("jdbc:vertica://localhost:5432/custom_db:test_tbl", "custom_db", None, "test_tbl"),
    (
        "jdbc:vertica://localhost:5432/custom_db:schem.test_tbl",
        "custom_db",
        "schem",
        "test_tbl",
    ),
    (
        "jdbc:redshift://ec2-192-168-29-1.us-east-2.compute.amazonaws.com:5432/custom_db:test_tbl",
        "custom_db",
        None,
        "test_tbl",
    ),
]


class SplineUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        config = OpenMetadataWorkflowConfig.model_validate(mock_spline_config)
        self.spline = SplineSource.create(
            mock_spline_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.spline.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        self.spline.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root

    def test_client(self):
        with patch.object(REST, "get", return_value=mock_data.get("execution-events")):
            self.assertEqual(
                list(self.spline.client.get_pipelines()), [EXPECTED_SPLINE_PIPELINES]
            )

        with patch.object(REST, "get", return_value=mock_data.get("lineage-detailed")):
            self.assertEqual(
                self.spline.client.get_lineage_details(PIPELINE_ID),
                EXPECTED_LINEAGE_DETAILS,
            )

    def test_pipeline_name(self):
        assert (
            self.spline.get_pipeline_name(EXPECTED_SPLINE_PIPELINES.items[0])
            == EXPECTED_SPLINE_PIPELINES.items[0].applicationName
        )

    def test_pipelines(self):
        pipline = list(self.spline.yield_pipeline(EXPECTED_SPLINE_PIPELINES.items[0]))[
            0
        ].right
        assert pipline == EXPECTED_CREATED_PIPELINES

    def test_jdbc_parsing(self):
        for example in JDBC_PARSING_EXAMPLES:
            result = parse_jdbc_url(example[0])
            self.assertEqual(result, example[1:])
