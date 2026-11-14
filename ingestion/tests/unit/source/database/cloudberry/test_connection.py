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
"""Tests for Cloudberry connection discovery."""

from metadata.generated.schema.entity.services.connections.database.cloudberryConnection import (
    CloudberryConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.ingestion.source.connections import create_connection
from metadata.utils.ssl_manager import check_ssl_and_init


def test_cloudberry_config_resolves_to_postgresql_engine():
    connection = DatabaseConnection.model_validate(
        {
            "config": {
                "type": "Cloudberry",
                "username": "catalog",
                "authType": {"password": "p@ss:word"},
                "hostPort": "localhost:5432",
                "database": "analytics",
            }
        }
    ).config

    assert isinstance(connection, CloudberryConnection)
    owner = create_connection(connection)
    assert owner is not None
    with owner:
        url = owner.client.url
        assert (url.drivername, url.username, url.password, url.database) == (
            "postgresql+psycopg2",
            "catalog",
            "p@ss:word",
            "analytics",
        )


def test_cloudberry_tls_config_reaches_psycopg2():
    config = CloudberryConnection.model_validate(
        {
            "username": "catalog",
            "authType": {"password": "test-password"},
            "hostPort": "localhost:5432",
            "database": "analytics",
            "sslMode": "verify-full",
            "sslConfig": {"caCertificate": "test-ca"},
        }
    )
    ssl_manager = check_ssl_and_init(config)
    assert ssl_manager is not None
    try:
        ssl_manager.setup_ssl(config)
        assert config.connectionArguments.root["sslmode"] == "verify-full"
        assert config.connectionArguments.root["sslrootcert"] == ssl_manager.ca_file_path
    finally:
        ssl_manager.cleanup_temp_files()
