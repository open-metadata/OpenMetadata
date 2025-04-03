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
Validate metadata ingestion workflow generation
"""
import json
import uuid
from datetime import datetime
from unittest import TestCase
from unittest.mock import patch

from openmetadata_managed_apis.workflows.ingestion.lineage import (
    build_lineage_workflow_config,
)
from openmetadata_managed_apis.workflows.ingestion.metadata import (
    build_metadata_workflow_config,
)
from openmetadata_managed_apis.workflows.ingestion.profiler import (
    build_profiler_workflow_config,
)
from openmetadata_managed_apis.workflows.ingestion.test_suite import (
    build_test_suite_workflow_config,
)
from openmetadata_managed_apis.workflows.ingestion.usage import (
    build_usage_workflow_config,
)

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    AirflowConfig,
    IngestionPipeline,
    PipelineType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryUsagePipeline import (
    DatabaseServiceQueryUsagePipeline,
)
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuitePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.basic import DateTime
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.data_quality import TestSuiteWorkflow
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow


def mock_set_ingestion_pipeline_status(self, state):
    return True


START_DATE = DateTime(datetime.strptime("2022-06-10T15:06:47", "%Y-%m-%dT%H:%M:%S"))


class OMetaServiceTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    data = {
        "type": "mysql",
        "serviceName": "test-workflow-mysql",
        "serviceConnection": {
            "config": {
                "type": "Mysql",
                "username": "openmetadata_user",
                "authType": {"password": "openmetadata_password"},
                "hostPort": "localhost:3306",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    usage_data = {
        "type": "snowflake",
        "serviceName": "local_snowflake",
        "serviceConnection": {
            "config": {
                "type": "Snowflake",
                "username": "openmetadata_user",
                "password": "random",
                "warehouse": "warehouse",
                "account": "account",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseUsage", "queryLogDuration": 10}},
    }

    lineage_data = {
        "type": "snowflake",
        "serviceName": "local_snowflake",
        "serviceConnection": {
            "config": {
                "type": "Snowflake",
                "username": "openmetadata_user",
                "password": "random",
                "warehouse": "warehouse",
                "account": "account",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseLineage", "queryLogDuration": 10}},
    }

    workflow_source = WorkflowSource(**data)
    usage_workflow_source = WorkflowSource(**usage_data)

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients.

        Mock a db service to build the IngestionPipeline
        """
        cls.service: DatabaseService = cls.metadata.get_service_or_create(
            entity=DatabaseService, config=cls.workflow_source
        )

        cls.usage_service: DatabaseService = cls.metadata.get_service_or_create(
            entity=DatabaseService,
            config=cls.usage_workflow_source,
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """
        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=cls.service.id,
            recursive=True,
            hard_delete=True,
        )

    @patch.object(
        MetadataWorkflow,
        "set_ingestion_pipeline_status",
        mock_set_ingestion_pipeline_status,
    )
    def test_ingestion_workflow(self):
        """
        Validate that the ingestionPipeline can be parsed
        and properly load a Workflow
        """

        ingestion_pipeline = IngestionPipeline(
            id=uuid.uuid4(),
            name="test_ingestion_workflow",
            pipelineType=PipelineType.metadata,
            fullyQualifiedName="local_mysql.test_ingestion_workflow",
            sourceConfig=SourceConfig(config=DatabaseServiceMetadataPipeline()),
            openMetadataServerConnection=self.server_config,
            airflowConfig=AirflowConfig(
                startDate=START_DATE,
            ),
            service=EntityReference(
                id=self.service.id,
                type="databaseService",
                name=self.service.name.root,
            ),
        )

        workflow_config = build_metadata_workflow_config(ingestion_pipeline)
        config = json.loads(workflow_config.model_dump_json())

        parse_workflow_config_gracefully(config)

    @patch.object(
        MetadataWorkflow,
        "set_ingestion_pipeline_status",
        mock_set_ingestion_pipeline_status,
    )
    def test_usage_workflow(self):
        """
        Validate that the ingestionPipeline can be parsed
        and properly load a usage Workflow
        """

        ingestion_pipeline = IngestionPipeline(
            id=uuid.uuid4(),
            name="test_usage_workflow",
            pipelineType=PipelineType.usage,
            fullyQualifiedName="local_snowflake.test_usage_workflow",
            sourceConfig=SourceConfig(config=DatabaseServiceQueryUsagePipeline()),
            openMetadataServerConnection=self.server_config,
            airflowConfig=AirflowConfig(
                startDate=START_DATE,
            ),
            service=EntityReference(
                id=self.usage_service.id,
                type="databaseService",
                name=self.usage_service.name.root,
            ),
        )

        workflow_config = build_usage_workflow_config(ingestion_pipeline)
        self.assertIn("usage", workflow_config.source.type)

        config = json.loads(workflow_config.model_dump_json())

        parse_workflow_config_gracefully(config)

    @patch.object(
        MetadataWorkflow,
        "set_ingestion_pipeline_status",
        mock_set_ingestion_pipeline_status,
    )
    def test_lineage_workflow(self):
        """
        Validate that the ingestionPipeline can be parsed
        and properly load a lineage Workflow
        """

        ingestion_pipeline = IngestionPipeline(
            id=uuid.uuid4(),
            name="test_lineage_workflow",
            pipelineType=PipelineType.lineage,
            fullyQualifiedName="local_snowflake.test_lineage_workflow",
            sourceConfig=SourceConfig(config=DatabaseServiceQueryLineagePipeline()),
            openMetadataServerConnection=self.server_config,
            airflowConfig=AirflowConfig(
                startDate=START_DATE,
            ),
            service=EntityReference(
                id=self.usage_service.id,
                type="databaseService",
                name=self.usage_service.name.root,
            ),
        )

        workflow_config = build_lineage_workflow_config(ingestion_pipeline)
        self.assertIn("lineage", workflow_config.source.type)

        config = json.loads(workflow_config.model_dump_json())

        parse_workflow_config_gracefully(config)

    @patch.object(
        ProfilerWorkflow,
        "set_ingestion_pipeline_status",
        mock_set_ingestion_pipeline_status,
    )
    def test_profiler_workflow(self):
        """
        Validate that the ingestionPipeline can be parsed
        and properly load a Profiler Workflow
        """

        ingestion_pipeline = IngestionPipeline(
            id=uuid.uuid4(),
            name="test_profiler_workflow",
            pipelineType=PipelineType.profiler,
            fullyQualifiedName="local_mysql.test_profiler_workflow",
            sourceConfig=SourceConfig(config=DatabaseServiceProfilerPipeline()),
            openMetadataServerConnection=self.server_config,
            airflowConfig=AirflowConfig(
                startDate=START_DATE,
            ),
            service=EntityReference(
                id=self.service.id,
                type="databaseService",
                name=self.service.name.root,
            ),
        )

        workflow_config = build_profiler_workflow_config(ingestion_pipeline)
        config = json.loads(workflow_config.model_dump_json())

        parse_workflow_config_gracefully(config)

    @patch.object(
        TestSuiteWorkflow,
        "set_ingestion_pipeline_status",
        mock_set_ingestion_pipeline_status,
    )
    def test_test_suite_workflow(self):
        """
        Validate that the ingestionPipeline can be parsed
        and properly load a Test Suite Workflow
        """

        ingestion_pipeline = IngestionPipeline(
            id=uuid.uuid4(),
            name="test_test_suite_workflow",
            pipelineType=PipelineType.TestSuite,
            fullyQualifiedName="local_mysql.test_test_suite_workflow",
            sourceConfig=SourceConfig(
                config=TestSuitePipeline(
                    type="TestSuite",
                    entityFullyQualifiedName=self.service.name.root,
                )
            ),
            openMetadataServerConnection=self.server_config,
            airflowConfig=AirflowConfig(
                startDate=START_DATE,
            ),
            service=EntityReference(
                id=uuid.uuid4(),
                type="testSuite",
                name="test_test_suite_workflow",
            ),
        )

        workflow_config = build_test_suite_workflow_config(ingestion_pipeline)
        config = json.loads(workflow_config.model_dump_json())

        parse_workflow_config_gracefully(config)
