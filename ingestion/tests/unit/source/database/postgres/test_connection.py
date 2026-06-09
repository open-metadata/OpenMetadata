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
"""Unit tests for PostgreSQL connection handling (auth strategies)."""

from unittest.mock import patch

from azure.core.credentials import AccessToken
from azure.identity import ClientSecretCredential

from metadata.generated.schema.entity.services.connections.database.common.azureConfig import (
    AzureConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection as PostgresConnectionConfig,
)
from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)
from metadata.ingestion.source.database.postgres.connection import PostgresConnection


def _azure_connection() -> PostgresConnectionConfig:
    return PostgresConnectionConfig(
        username="openmetadata_user",
        authType=AzureConfigurationSource(
            azureConfig=AzureCredentials(
                clientId="clientid",
                tenantId="tenantid",
                clientSecret="clientsecret",
                scopes="scope1,scope2",
            )
        ),
        hostPort="localhost:5432",
        database="openmetadata_db",
    )


def test_basic_auth_builds_expected_url():
    connection = PostgresConnectionConfig(
        username="openmetadata_user",
        authType=BasicAuth(password="openmetadata_password"),
        hostPort="localhost:5432",
        database="openmetadata_db",
    )
    engine = PostgresConnection(connection).client
    assert (
        engine.url.render_as_string(hide_password=False)
        == "postgresql+psycopg2://openmetadata_user:openmetadata_password@localhost:5432/openmetadata_db"
    )


def test_azure_ad_uses_token_as_password():
    connection = _azure_connection()
    with patch.object(
        ClientSecretCredential,
        "get_token",
        return_value=AccessToken(token="mocked_token", expires_on=100),
    ):
        engine = PostgresConnection(connection).client
    assert (
        engine.url.render_as_string(hide_password=False)
        == "postgresql+psycopg2://openmetadata_user:mocked_token@localhost:5432/openmetadata_db"
    )


def test_azure_ad_does_not_mutate_caller_connection():
    connection = _azure_connection()
    with patch.object(
        ClientSecretCredential,
        "get_token",
        return_value=AccessToken(token="mocked_token", expires_on=100),
    ):
        assert PostgresConnection(connection).client is not None
    assert isinstance(connection.authType, AzureConfigurationSource)
