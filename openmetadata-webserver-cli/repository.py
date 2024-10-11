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
from metadata.generated.schema.entity.automations.testServiceConnection import TestServiceConnectionRequest
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import \
    OpenMetadataConnection, AuthProvider
from metadata.generated.schema.entity.services.connections.testConnectionResult import TestConnectionResult
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import OpenMetadataJWTClientConfig
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.utils.singleton import Singleton


class LocalIngestionServer(metaclass=Singleton):
    """Local ingestion server helper"""
    def __init__(self, server_url: str, token: str):
        server_config = OpenMetadataConnection(
            hostPort=server_url,
            authProvider=AuthProvider.openmetadata,
            securityConfig=OpenMetadataJWTClientConfig(jwtToken=CustomSecretStr(token)),
        )
        self.metadata = OpenMetadata(server_config)
        assert self.metadata.health_check()

    def _test_connection(self, request: TestServiceConnectionRequest) -> TestConnectionResult:
        """
        Run the sync test connection
        """
        connection = get_connection(request.connection.config)
        # Find the test_connection function in each <source>/connection.py file
        test_connection_fn = get_test_connection_fn(request.connection.config)
        res = test_connection_fn(
            self.metadata, connection, request.connection.config, None, None
        )
        return res
