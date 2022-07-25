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
Validate metadata ingestion workflow generation
"""
import json
import uuid
from unittest import TestCase

from openmetadata_managed_apis.api.utils import clean_dag_id
from openmetadata_managed_apis.workflows.ingestion.metadata import build_metadata_workflow_config
from openmetadata_managed_apis.workflows.ingestion.profiler import build_profiler_workflow_config
from openmetadata_managed_apis.workflows.ingestion.usage import build_usage_workflow_config

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
from metadata.generated.schema.metadataIngestion.databaseServiceQueryUsagePipeline import (
    DatabaseServiceQueryUsagePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.workflow import Workflow
from metadata.ingestion.models.encoders import show_secrets_encoder
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.orm_profiler.api.workflow import ProfilerWorkflow


class OMetaServiceTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = OpenMetadataConnection(hostPort="http://localhost:8585/api")
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    data = {
        "type": "mysql",
        "serviceName": "test-workflow-mysql",
        "serviceConnection": {
            "config": {
                "type": "Mysql",
                "username": "openmetadata_user",
                "password": "openmetadata_password",
                "hostPort": "localhost:3306",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    # TODO update to "snowflake-usage" after https://github.com/open-metadata/OpenMetadata/issues/4469
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
        "sourceConfig": {"config": {"queryLogDuration": 10}},
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

    def test_clean_dag_id(self):
        """
        Validate dag_id clean
        """
        self.assertEqual(clean_dag_id("hello"), "hello")
        self.assertEqual(clean_dag_id("hello(world)"), "hello_world_")
        self.assertEqual(clean_dag_id("hello-world"), "hello-world")
        self.assertEqual(clean_dag_id("%%&^++hello__"), "_hello__")

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
                startDate="2022-06-10T15:06:47+00:00",
            ),
            service=EntityReference(
                id=self.service.id,
                type="databaseService",
                name=self.service.name.__root__,
            ),
        )

        workflow_config = build_metadata_workflow_config(ingestion_pipeline)
        config = json.loads(workflow_config.json(encoder=show_secrets_encoder))

        Workflow.create(config)

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
                startDate="2022-06-10T15:06:47+00:00",
            ),
            service=EntityReference(
                id=self.usage_service.id,
                type="databaseService",
                name=self.usage_service.name.__root__,
            ),
        )

        workflow_config = build_usage_workflow_config(ingestion_pipeline)
        self.assertIn("usage", workflow_config.source.type)

        config = json.loads(workflow_config.json(encoder=show_secrets_encoder))

        Workflow.create(config)

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
                startDate="2022-06-10T15:06:47+00:00",
            ),
            service=EntityReference(
                id=self.service.id,
                type="databaseService",
                name=self.service.name.__root__,
            ),
        )

        workflow_config = build_profiler_workflow_config(ingestion_pipeline)
        config = json.loads(workflow_config.json(encoder=show_secrets_encoder))

        ProfilerWorkflow.create(config)
