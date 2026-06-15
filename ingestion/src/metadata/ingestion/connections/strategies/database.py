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
Shared client strategies for SQLAlchemy-engine database connectors.

These cover the auth modes used across multiple database connectors. A
connector selects one per ``authType`` in its ``_get_client``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, TypeVar

from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
)
from metadata.ingestion.connections.strategies.base import ClientStrategy
from metadata.utils.credentials import get_azure_access_token

if TYPE_CHECKING:
    from pydantic import BaseModel
    from sqlalchemy.engine import Engine

    from metadata.generated.schema.entity.services.connections.database.common.azureConfig import (
        AzureConfigurationSource,
    )

# A database service-connection config; concrete at each call site.
ConnectionConfig = TypeVar("ConnectionConfig", bound="BaseModel")


class BasicAuthStrategy(ClientStrategy[ConnectionConfig, "Engine"]):
    """Builds an engine from the connection URL via the common builders.

    Covers basic username/password auth and serves as the default for any
    authType that needs no special engine handling.
    """

    def build(self) -> Engine:
        return create_generic_db_connection(
            connection=self._connection,
            get_connection_url_fn=get_connection_url_common,
            get_connection_args_fn=get_connection_args_common,
        )


class AzureAdStrategy(ClientStrategy[ConnectionConfig, "Engine"]):
    """Builds an engine using an Azure AD access token as the password."""

    def __init__(self, connection: ConnectionConfig, auth: AzureConfigurationSource) -> None:
        super().__init__(connection)
        self._auth = auth

    def build(self) -> Engine:
        access_token = get_azure_access_token(self._auth)
        # Copy with the token swapped in as a basic-auth password so the caller's
        # service_connection keeps its Azure authType (and the short-lived token
        # never leaks back into it).
        connection = self._connection.model_copy(
            update={"authType": BasicAuth.model_validate({"password": access_token})},
            deep=True,
        )
        return BasicAuthStrategy(connection).build()
