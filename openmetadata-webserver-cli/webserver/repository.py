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
Local webserver ingestion repository
"""
import logging
import uuid
from typing import Optional

from metadata.generated.schema.api.services.ingestionPipelines.createIngestionPipeline import (
    CreateIngestionPipelineRequest,
)
from metadata.generated.schema.entity.automations.testServiceConnection import (
    TestServiceConnectionRequest,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    OpenMetadataWorkflowConfig,
    Sink,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.ingestion.models.custom_types import ServiceWithConnectionType
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.utils.singleton import Singleton
from metadata.workflow.metadata import MetadataWorkflow

from webserver.models import OMetaServerModel, ServiceModel


class MissingStateException(Exception):
    """Missing state exception"""

    def __init__(self, value: str):
        super().__init__(f"{value} not initialized!")


class LocalIngestionServer(metaclass=Singleton):
    """Local ingestion server helper"""

    def __init__(self):
        self._metadata: Optional[OpenMetadata] = None
        self._service: Optional[ServiceModel] = None
        self._ingestion_pipeline: Optional[CreateIngestionPipelineRequest] = None
        self._workflow_config: Optional[OpenMetadataWorkflowConfig] = None

    @property
    def metadata(self) -> OpenMetadata:
        if not self._metadata:
            raise MissingStateException("Metadata")
        return self._metadata

    @property
    def service(self) -> ServiceModel:
        if not self._service:
            raise MissingStateException("Service")
        return self._service

    @property
    def ingestion_pipeline(self) -> CreateIngestionPipelineRequest:
        if not self._ingestion_pipeline:
            raise MissingStateException("Source config")
        return self._ingestion_pipeline

    def set_ingestion_pipeline(self, raw_ingestion: dict):
        # Set a random ID. We'll pick it up later from the db
        raw_ingestion["service"]["id"] = self._service.id
        self._ingestion_pipeline = CreateIngestionPipelineRequest.model_validate(
            raw_ingestion
        )

    def set_service(self, raw_service_connection: dict):
        self._service = ServiceModel(
            id=str(uuid.uuid4()),
            name=raw_service_connection["name"],
            serviceType=raw_service_connection["serviceType"],
            connection=ServiceConnection.model_validate(
                raw_service_connection["connection"]
            ),
        )

    def init_ometa(self, ometa_server: OMetaServerModel):
        """Initialize the client"""
        server_config = OpenMetadataConnection(
            hostPort=str(ometa_server.server_url),
            authProvider=AuthProvider.openmetadata,
            securityConfig=OpenMetadataJWTClientConfig(
                jwtToken=CustomSecretStr(ometa_server.token)
            ),
        )
        self._metadata = OpenMetadata(server_config)
        assert self.metadata.health_check()
        logging.info("Initialized OpenMetadata client")

    def test_connection(
        self, request: TestServiceConnectionRequest
    ) -> TestConnectionResult:
        """
        Run the sync test connection
        """
        connection = get_connection(request.connection.config)
        # Find the test_connection function in each <source>/connection.py file
        test_connection_fn = get_test_connection_fn(request.connection.config)
        res: TestConnectionResult = test_connection_fn(
            self.metadata, connection, request.connection.config, None, None
        )
        return res

    def build_workflow(self) -> OpenMetadataWorkflowConfig:
        """Build the workflow"""
        # TODO: dynamic build from pipelineType
        self._workflow_config = OpenMetadataWorkflowConfig(
            source=WorkflowSource(
                type=self._service.serviceType,
                serviceName=self._service.name.root,
                serviceConnection=self._service.connection,
                sourceConfig=self.ingestion_pipeline.sourceConfig,
            ),
            sink=Sink(
                type="metadata-rest",
                config={},
            ),
            workflowConfig=WorkflowConfig(
                loggerLevel=self.ingestion_pipeline.loggerLevel,
                openMetadataServerConfig=self.metadata.config,
            ),
            ingestionPipelineFQN=None,
        )

        return self._workflow_config

    def run_workflow(self) -> None:
        """Run the workflow"""
        # TODO DYNAMIC RUNS
        workflow = MetadataWorkflow(self._workflow_config)
        workflow.execute()
        workflow.stop()
        workflow.print_status()
