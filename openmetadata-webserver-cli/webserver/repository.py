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
from typing import Optional

from metadata.generated.schema.entity.automations.testServiceConnection import (
    TestServiceConnectionRequest,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
    AuthProvider,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.utils.singleton import Singleton
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
    OpenMetadataWorkflowConfig,
)

from webserver.models import OMetaServerModel


class MissingStateException(Exception):
    """Missing state exception"""

    def __init__(self, value: str):
        super().__init__(f"{value} not initialized!")


class LocalIngestionServer(metaclass=Singleton):
    """Local ingestion server helper"""

    def __init__(self):
        self._metadata: Optional[OpenMetadata] = None
        self._service_connection: Optional[ServiceConnection] = None
        self._source_config: Optional[WorkflowSource] = None

    @property
    def metadata(self) -> OpenMetadata:
        if not self._metadata:
            raise MissingStateException("Metadata")
        return self._metadata

    @property
    def service_connection(self) -> ServiceConnection:
        if not self._service_connection:
            raise MissingStateException("Service connection")
        return self._service_connection

    @property
    def source_config(self) -> WorkflowSource:
        if not self._source_config:
            raise MissingStateException("Source config")
        return self._source_config

    @source_config.setter
    def source_config(self, source_config: dict):
        self._source_config = WorkflowSource.model_validate(source_config)

    @service_connection.setter
    def service_connection(self, service_connection: dict):

        self._service_connection = ServiceConnection.model_validate(
            service_connection.get("connection")
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
