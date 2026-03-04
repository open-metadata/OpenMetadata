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
