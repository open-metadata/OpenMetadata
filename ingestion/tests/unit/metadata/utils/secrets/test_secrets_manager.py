#  Copyright 2022 Collate
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
Test Secrets Manager Factory
"""
import uuid
from unittest import TestCase

from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DbtHttpConfig,
)
from metadata.generated.schema.security.client.googleSSOClientConfig import (
    GoogleSSOClientConfig,
)
from metadata.utils.secrets.secrets_manager import AUTH_PROVIDER_MAPPING

DATABASE_CONNECTION_CONFIG = {
    "type": "Mysql",
    "username": "test",
    "hostPort": "localhost:3306",
}

DATABASE_CONNECTION = {"config": DATABASE_CONNECTION_CONFIG}

DATABASE_SERVICE = {
    "id": uuid.uuid4(),
    "name": "test_service",
    "serviceType": DatabaseServiceType.Mysql,
    "connection": DatabaseConnection(),
}

AUTH_PROVIDER_CONFIG = {"secretKey": "/fake/path"}

DBT_SOURCE_CONFIG = {
    "dbtUpdateDescriptions": True,
    "dbtCatalogHttpPath": "/fake/path",
    "dbtManifestHttpPath": "/fake/path",
    "dbtRunResultsHttpPath": "/fake/path",
}


class TestSecretsManager(TestCase):
    def test_all_auth_provider_has_auth_client(self):
        auth_provider_with_client = [
            e for e in AuthProvider if e is not AuthProvider.no_auth
        ]
        for auth_provider in auth_provider_with_client:
            assert AUTH_PROVIDER_MAPPING.get(auth_provider, None) is not None

    class External(TestCase):
        service_type: str = "database"
        service: DatabaseService
        service_connection: ServiceConnection
        database_connection = MysqlConnection(**DATABASE_CONNECTION_CONFIG)
        auth_provider_config = GoogleSSOClientConfig(**AUTH_PROVIDER_CONFIG)
        om_connection: OpenMetadataConnection
        dbt_source_config: DbtHttpConfig

        @classmethod
        def setUpClass(cls) -> None:
            cls.service = DatabaseService(**DATABASE_SERVICE)
            cls.service.connection = DatabaseConnection(config=cls.database_connection)
            cls.service_connection = ServiceConnection(__root__=cls.service.connection)
            cls.om_connection = OpenMetadataConnection(
                authProvider=AuthProvider.google,
                hostPort="http://localhost:8585/api",
            )
            cls.dbt_source_config = DbtHttpConfig.parse_obj(DBT_SOURCE_CONFIG)

        @staticmethod
        def build_open_metadata_connection(
            secret_manager_provider: SecretsManagerProvider,
        ) -> OpenMetadataConnection:
            return OpenMetadataConnection(
                secretsManagerProvider=secret_manager_provider,
                clusterName="openmetadata",
                hostPort="http://localhost:8585/api",
            )
