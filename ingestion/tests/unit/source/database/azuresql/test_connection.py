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
"""Unit tests for the AzureSQL BaseConnection wiring.

The URL building (Active Directory ODBC and standard) is covered in
tests/unit/test_build_connection_url.py.
"""

from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    AzureSQLConnection as AzureSQLConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.azuresql.connection import AzureSQLConnection

CONNECTION_MODULE = "metadata.ingestion.source.database.azuresql.connection"


def _config() -> AzureSQLConnectionConfig:
    return AzureSQLConnectionConfig(
        username="user",
        password="pass",
        hostPort="myhost:1433",
        database="mydb",
        driver="ODBC Driver 18 for SQL Server",
    )


def test_azuresql_connection_is_base_connection():
    assert issubclass(AzureSQLConnection, BaseConnection)


def test_get_client_uses_the_module_url_builder():
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = AzureSQLConnection(_config()).client
    assert mock_connection.call_args.kwargs["get_connection_url_fn"].__name__ == "get_connection_url"
