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
Test how we create and update status in Ingestion Pipelines
"""
import json
from unittest import TestCase

import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
    PipelineState,
    PipelineStatus,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    IngestionStatus,
    StackTraceError,
    StepSummary,
)
from metadata.ingestion.api.status import TruncatedStackTraceError
from metadata.workflow.metadata import MetadataWorkflow

from ..integration_base import (
    METADATA_INGESTION_CONFIG_TEMPLATE,
    generate_name,
    get_create_service,
)


class OMetaTableTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    metadata = int_admin_ometa()
    service_name = generate_name()

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """
        # Create the service entity
        create_service = get_create_service(
            entity=DatabaseService, name=cls.service_name
        )
        cls.service_entity = cls.metadata.create_or_update(data=create_service)

        workflow_config = json.loads(
            METADATA_INGESTION_CONFIG_TEMPLATE.format(
                type="mysql",
                service_name=cls.service_name,
                service_config=MysqlConnection(
                    username="openmetadata_user",
                    authType=BasicAuth(
                        password="openmetadata_password",
                    ),
                    hostPort="localhost:3306",
                ).model_dump_json(),
                source_config={},
            )
        )
        workflow_config["ingestionPipelineFQN"] = f"{cls.service_name}.ingestion"
        cls.workflow: MetadataWorkflow = MetadataWorkflow.create(workflow_config)

        # Since we won't run the full workflow, let's create the service first
        # which is needed to create the ingestion
        cls.metadata.get_service_or_create(
            entity=DatabaseService, config=cls.workflow.config.source
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn=cls.service_name
            ).id.root
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_create_ingestion_pipeline(self) -> None:
        """We can create an ingestion pipeline"""

        ingestion_pipeline: IngestionPipeline = self.workflow.ingestion_pipeline
        assert ingestion_pipeline is not None
        assert ingestion_pipeline.name.root == "ingestion"

    def test_add_status(self) -> None:
        """We can add status to the ingestion pipeline"""

        ingestion_pipeline: IngestionPipeline = self.workflow.ingestion_pipeline
        assert ingestion_pipeline is not None

        # We can send a status to the ingestion pipeline
        ingestion_status = IngestionStatus(
            [
                StepSummary(
                    name="source",
                    failures=[
                        StackTraceError(
                            name="error",
                            error="error",
                            stackTrace="stackTrace",
                        )
                    ],
                )
            ]
        )

        pipeline_status: PipelineStatus = self.workflow._new_pipeline_status(
            PipelineState.success
        )
        pipeline_status.status = ingestion_status

        # Gets properly created
        self.metadata.create_or_update_pipeline_status(
            ingestion_pipeline.fullyQualifiedName.root, pipeline_status
        )

        real_pipeline_status: PipelineStatus = self.metadata.get_pipeline_status(
            ingestion_pipeline.fullyQualifiedName.root, self.workflow.run_id
        )
        assert real_pipeline_status.pipelineState == PipelineState.success

        # If the status has too long names/errors it will fail
        too_long_status = IngestionStatus(
            [
                StepSummary(
                    name="source",
                    failures=[
                        StackTraceError(
                            name="error",
                            error="error" * 20_000_000,
                            stackTrace="stackTrace",
                        )
                    ],
                )
            ]
        )

        pipeline_status: PipelineStatus = self.workflow._new_pipeline_status(
            PipelineState.success
        )
        pipeline_status.status = too_long_status

        # We get a bad request error
        with pytest.raises(Exception) as exc:
            self.metadata.create_or_update_pipeline_status(
                ingestion_pipeline.fullyQualifiedName.root, pipeline_status
            )

        assert ("exceeds the maximum allowed" in str(exc.value)) or (
            "Connection aborted." in str(exc.value)
        )

        # If we truncate the status it all runs good
        truncated_long_status = IngestionStatus(
            [
                StepSummary(
                    name="source",
                    failures=[
                        TruncatedStackTraceError(
                            name="error",
                            error="error" * 20_000_000,
                            stackTrace="stackTrace",
                        )
                    ],
                )
            ]
        )

        pipeline_status: PipelineStatus = self.workflow._new_pipeline_status(
            PipelineState.success
        )
        pipeline_status.status = truncated_long_status

        res = self.metadata.create_or_update_pipeline_status(
            ingestion_pipeline.fullyQualifiedName.root, pipeline_status
        )

        assert (
            res["entityFullyQualifiedName"]
            == ingestion_pipeline.fullyQualifiedName.root
        )
