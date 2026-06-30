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

import socket
from unittest.mock import MagicMock, patch

from metadata.core.connections.test_connection import collect_checks
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection as MssqlConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlScheme,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.mssql.connection import (
    MSSQL_ERRORS,
    MssqlChecks,
    MssqlConnection,
    get_connection_url,
)
from metadata.ingestion.source.database.mssql.queries import (
    MSSQL_GET_CURRENT_DATABASE,
    MSSQL_GET_DATABASE,
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


def _checks() -> MssqlChecks:
    return MssqlChecks(client=MagicMock(), get_databases_statement="SELECT 1")


def test_every_definition_step_resolves_to_a_check():
    collected = collect_checks(_checks())
    assert set(collected) == {
        DatabaseStep.CheckAccess,
        DatabaseStep.GetDatabases,
        DatabaseStep.GetSchemas,
        DatabaseStep.GetTables,
        DatabaseStep.GetViews,
        DatabaseStep.GetQueries,
    }


def test_building_checks_does_not_touch_the_network():
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_engine:
        provider = MssqlConnection(_config()).checks()
    engine = mock_engine.return_value
    engine.connect.assert_not_called()
    engine.exec_driver_sql.assert_not_called()
    assert isinstance(provider, MssqlChecks)


def test_get_databases_statement_uses_current_db_when_not_ingest_all():
    config = _config()
    config.ingestAllDatabases = False
    handler = MssqlConnection(config)
    handler._client = MagicMock()
    assert handler._get_databases_statement() == MSSQL_GET_CURRENT_DATABASE


def test_get_databases_statement_uses_all_dbs_when_ingest_all():
    config = _config()
    config.ingestAllDatabases = True
    handler = MssqlConnection(config)
    handler._client = MagicMock()
    assert handler._get_databases_statement() == MSSQL_GET_DATABASE


def _pymssql_error(number: int, message: str) -> Exception:
    """A pymssql-style driver error: numeric SQL Server code in ``args[0]``,
    wrapped by SQLAlchemy which preserves the original on ``.orig``."""
    orig = Exception(number, message)
    wrapper = Exception(f"({number}) {message}")
    wrapper.orig = orig  # type: ignore[attr-defined]
    return wrapper


def _pyodbc_error(sqlstate: str, message: str) -> Exception:
    """A pyodbc-style driver error: SQLSTATE + message text, no numeric code."""
    return Exception(f"('{sqlstate}', \"[{sqlstate}] {message}\")")


def test_pymssql_login_failure_classifies_as_auth():
    diagnosis = MSSQL_ERRORS.classify(_pymssql_error(18456, "Login failed for user 'x'"))
    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_pyodbc_login_failure_classifies_as_auth():
    diagnosis = MSSQL_ERRORS.classify(_pyodbc_error("28000", "Login failed for user 'x'."))
    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_pymssql_database_not_found_classifies():
    diagnosis = MSSQL_ERRORS.classify(_pymssql_error(4060, 'Cannot open database "x" requested by the login.'))
    assert diagnosis is not None
    assert diagnosis.title == "Database not found or not accessible"


def test_pyodbc_cannot_open_database_classifies():
    diagnosis = MSSQL_ERRORS.classify(_pyodbc_error("42000", 'Cannot open database "x" requested by the login.'))
    assert diagnosis is not None
    assert diagnosis.title == "Database not found or not accessible"


def test_pymssql_permission_denied_classifies():
    diagnosis = MSSQL_ERRORS.classify(_pymssql_error(229, "The SELECT permission was denied on the object 'x'."))
    assert diagnosis is not None
    assert diagnosis.title == "Insufficient privileges"


def test_pyodbc_permission_denied_classifies():
    diagnosis = MSSQL_ERRORS.classify(_pyodbc_error("42000", "The SELECT permission was denied on the object 'x'."))
    assert diagnosis is not None
    assert diagnosis.title == "Insufficient privileges"


def test_network_pack_is_folded_in():
    diagnosis = MSSQL_ERRORS.classify(socket.gaierror("Name or service not known"))
    assert diagnosis is not None
    assert diagnosis.title == "Host could not be resolved"


def test_unknown_error_is_not_classified():
    assert MSSQL_ERRORS.classify(Exception("something unexpected")) is None
