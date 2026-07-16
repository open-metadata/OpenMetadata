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

from typing import Union  # noqa: I001
from urllib.parse import quote_plus

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
    DatabricksScheme,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    DatabricksScheme as UnityCatalogScheme,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)


# Databricks and Unity Catalog both dial the workspace over HTTPS; the gate
# TCP-probes this port when hostPort carries none.
DEFAULT_WORKSPACE_PORT = 443

# Both connection schemas default `scheme` to this. Codegen emits a separate enum
# per schema, so the two are distinct types carrying the same members.
DEFAULT_SCHEME = DatabricksScheme.databricks.value
Scheme = Union[DatabricksScheme, UnityCatalogScheme]  # noqa: UP007


def normalize_host_port(host_port: str) -> str:
    """Strip a pasted URL scheme and path, leaving ``host:port``."""
    return host_port.split("://", 1)[-1].split("/", 1)[0]


def probe_target(host_port: str, default_port: int = DEFAULT_WORKSPACE_PORT) -> tuple[str, int]:
    """The host:port a gate check should TCP-probe, normalized the way the client
    dials it so the probe targets the host the driver will actually reach."""
    normalized = normalize_host_port(host_port)
    host, _, port = normalized.rpartition(":")
    if host and port.isdigit():
        return host, int(port)
    return normalized, default_port


def catalog_url(scheme: Scheme | None, host_port: str, catalog: str | None) -> str:
    """The SQLAlchemy URL for a workspace, scoped to ``catalog`` when configured.

    ``scheme`` is optional on both connection schemas, defaulting to the same value.
    """
    url = f"{scheme.value if scheme else DEFAULT_SCHEME}://{normalize_host_port(host_port)}"
    if catalog:
        url = f"{url}?catalog={quote_plus(catalog)}"
    return url


def _host(connection: Union[DatabricksConnection, UnityCatalogConnection]) -> str:  # noqa: UP007
    return normalize_host_port(connection.hostPort).split(":")[0]


def get_personal_access_token_auth(
    connection: Union[DatabricksConnection, UnityCatalogConnection],  # noqa: UP007
) -> dict:
    """
    Configure Personal Access Token authentication
    """
    return {"access_token": connection.authType.token.get_secret_value()}


def get_databricks_oauth_auth(
    connection: Union[DatabricksConnection, UnityCatalogConnection],  # noqa: UP007
):
    """
    Create Databricks OAuth2 M2M credentials provider for Service Principal authentication
    """

    def credential_provider():
        hostname = _host(connection)
        config = Config(
            host=f"https://{hostname}",
            client_id=connection.authType.clientId,
            client_secret=connection.authType.clientSecret.get_secret_value(),
        )
        return oauth_service_principal(config)

    return {"credentials_provider": credential_provider}


def get_azure_ad_auth(connection: Union[DatabricksConnection, UnityCatalogConnection]):  # noqa: UP007
    """
    Create Azure AD credentials provider for Azure Service Principal authentication
    """

    def credential_provider():
        hostname = _host(connection)
        config = Config(
            host=f"https://{hostname}",
            azure_client_secret=connection.authType.azureClientSecret.get_secret_value(),
            azure_client_id=connection.authType.azureClientId,
            azure_tenant_id=connection.authType.azureTenantId,
        )
        return azure_service_principal(config)

    return {"credentials_provider": credential_provider}


def get_auth_config(
    connection: Union[DatabricksConnection, UnityCatalogConnection],  # noqa: UP007
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
        raise ValueError(f"Unsupported authentication type: {type(connection.authType)}")

    return auth_method(connection)
