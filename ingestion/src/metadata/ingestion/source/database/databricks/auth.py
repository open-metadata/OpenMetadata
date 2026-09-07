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
This module provides authentication utilities for Databricks and Unity Catalog connections.
"""
from typing import Union

from databricks.sdk.core import Config, azure_service_principal, oauth_service_principal

from metadata.generated.schema.entity.services.connections.database.databricks.azureAdSetup import (
    AzureAdSetup,
)
from metadata.generated.schema.entity.services.connections.database.databricks.databricksOAuth import (
    DatabricksOauth,
)
from metadata.generated.schema.entity.services.connections.database.databricks.personalAccessToken import (
    PersonalAccessToken,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)

DatabricksAuthConnection = Union[DatabricksConnection, UnityCatalogConnection]
DEFAULT_SCHEME = "databricks"


def _host(connection: DatabricksAuthConnection) -> str:
    return connection.hostPort.split("://", 1)[-1].split("/", 1)[0].split(":", 1)[0]


def get_personal_access_token_auth(
    connection: Union[DatabricksConnection, UnityCatalogConnection],
) -> dict:
    """
    Configure Personal Access Token authentication
    """
    return {"access_token": connection.authType.token.get_secret_value()}


def get_databricks_oauth_auth(
    connection: Union[DatabricksConnection, UnityCatalogConnection],
):
    """
    Create Databricks OAuth2 M2M credentials provider for Service Principal authentication
    """

    def credential_provider():
        hostname = connection.hostPort.split(":")[0]
        config = Config(
            host=f"https://{hostname}",
            client_id=connection.authType.clientId,
            client_secret=connection.authType.clientSecret.get_secret_value(),
        )
        return oauth_service_principal(config)

    return {"credentials_provider": credential_provider}


def get_azure_ad_auth(connection: Union[DatabricksConnection, UnityCatalogConnection]):
    """
    Create Azure AD credentials provider for Azure Service Principal authentication
    """

    def credential_provider():
        hostname = connection.hostPort.split(":")[0]
        config = Config(
            host=f"https://{hostname}",
            azure_client_secret=connection.authType.azureClientSecret.get_secret_value(),
            azure_client_id=connection.authType.azureClientId,
            azure_tenant_id=connection.authType.azureTenantId,
        )
        return azure_service_principal(config)

    return {"credentials_provider": credential_provider}


def get_auth_config(
    connection: Union[DatabricksConnection, UnityCatalogConnection],
) -> dict:
    """
    Get authentication configuration for Databricks connection
    """
    auth_method = {
        PersonalAccessToken: get_personal_access_token_auth,
        DatabricksOauth: get_databricks_oauth_auth,
        AzureAdSetup: get_azure_ad_auth,
    }.get(type(connection.authType))

    if not auth_method:
        raise ValueError(
            f"Unsupported authentication type: {type(connection.authType)}"
        )

    return auth_method(connection)


class DataDiffConnectionError(Exception):
    """Raised when a connection cannot be described to data-diff.

    Not a ValueError: the data-diff param setter swallows those and falls back to a
    credential-less URL, which parks the driver on an interactive OAuth flow.
    """


def get_data_diff_auth(connection: DatabricksAuthConnection) -> dict:
    """Credential fields for a data-diff connection dict.

    Every value is a plain string: data-diff caches connections on ``json.dumps``
    of the dict, so credential providers are built on its side, not passed in.

    Raises:
        DataDiffConnectionError: on an unsupported authentication type.
    """
    auth_type = connection.authType
    if isinstance(auth_type, PersonalAccessToken):
        return {
            "auth_method": "pat",
            "access_token": auth_type.token.get_secret_value(),
        }
    if isinstance(auth_type, DatabricksOauth):
        return {
            "auth_method": "oauth-m2m",
            "databricks_client_id": auth_type.clientId,
            "databricks_client_secret": auth_type.clientSecret.get_secret_value(),
        }
    if isinstance(auth_type, AzureAdSetup):
        return {
            "auth_method": "azure-sp-m2m",
            "azure_client_id": auth_type.azureClientId,
            "azure_client_secret": auth_type.azureClientSecret.get_secret_value(),
            "azure_tenant_id": auth_type.azureTenantId,
        }
    raise DataDiffConnectionError(
        f"Unsupported authentication type for Data Diff: {type(auth_type).__name__}"
    )


def get_data_diff_connection_dict(connection: DatabricksAuthConnection) -> dict:
    """Service-level data-diff connection dict, without the table's catalog and schema.

    Raises:
        DataDiffConnectionError: when the connection cannot be expressed to data-diff.
    """
    if not connection.httpPath:
        raise DataDiffConnectionError(
            "Data Diff requires the connection's HTTP Path to be set"
        )
    return {
        "driver": DEFAULT_SCHEME,
        "server_hostname": _host(connection),
        "http_path": connection.httpPath,
        **get_data_diff_auth(connection),
    }
