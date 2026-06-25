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
"""Unit tests for the MSSQL BaseConnection wiring.

URL building (including the pyodbc delegation to azuresql) is covered in
tests/unit/test_source_url.py and tests/unit/test_source_connection.py.
"""

from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection as MssqlConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlScheme,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.mssql.connection import (
    MssqlConnection,
    get_connection_url,
)

CONNECTION_MODULE = "metadata.ingestion.source.database.mssql.connection"


def _config(scheme: MssqlScheme = MssqlScheme.mssql_pytds) -> MssqlConnectionConfig:
    return MssqlConnectionConfig(
        scheme=scheme,
        username="user",
        password="pass",
        hostPort="myhost:1433",
        database="mydb",
    )


def test_mssql_connection_is_base_connection():
    assert issubclass(MssqlConnection, BaseConnection)


def test_get_client_uses_the_module_url_builder():
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = MssqlConnection(_config()).client
    assert mock_connection.call_args.kwargs["get_connection_url_fn"].__name__ == "get_connection_url"


def test_pyodbc_scheme_delegates_to_azuresql_url_builder():
    with patch(f"{CONNECTION_MODULE}.get_pyodbc_connection_url", return_value="delegated") as mock_pyodbc:
        result = get_connection_url(_config(scheme=MssqlScheme.mssql_pyodbc))
    mock_pyodbc.assert_called_once()
    assert result == "delegated"


def test_non_pyodbc_scheme_uses_common_url_builder():
    url = get_connection_url(_config(scheme=MssqlScheme.mssql_pytds))
    assert url.startswith("mssql+pytds://")
