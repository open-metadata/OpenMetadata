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

from pathlib import Path
from unittest.mock import MagicMock, PropertyMock, patch

from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    AzureSQLConnection as AzureSQLConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
    TestConnectionDefinition,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.azuresql.connection import AzureSQLConnection
from metadata.ingestion.source.database.azuresql.queries import AZURE_SQL_GET_DATABASES

CONNECTION_MODULE = "metadata.ingestion.source.database.azuresql.connection"

AZURE_SQL_DEFINITION_JSON = (
    Path(__file__).parents[6]
    / "openmetadata-service/src/main/resources/json/data/testConnections/database/azuresql.json"
)


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


# -- GetDatabases test-connection step ----------------------------------------
#
# The metadata workflow runs ``AZURE_SQL_GET_DATABASES`` when
# ``ingestAllDatabases`` is enabled and during the ``mark_databases_as_deleted``
# post-process step. The Test Connection definition used to omit a
# ``GetDatabases`` step, so a tier or role that rejects the query (e.g. Azure
# SQL Database error 40515 on ``master.sys.databases``) passed Test Connection
# and failed later during ingestion. These tests pin both the seed step and the
# Python handler that backs it.


def test_test_connection_passes_get_databases_query_to_db_common():
    """The connection handler must register a ``GetDatabases`` check backed by
    the fixed listing query, so the seed step resolves to a function."""
    connection = AzureSQLConnection(_config())
    with patch(f"{CONNECTION_MODULE}.test_connection_db_common", return_value=MagicMock()) as mock_db_common:
        connection.test_connection(metadata=MagicMock())
    assert mock_db_common.call_args.kwargs["queries"] == {"GetDatabases": AZURE_SQL_GET_DATABASES}


def _azuresql_definition() -> TestConnectionDefinition:
    """The AzureSQL definition the server seeds, read from the resource so the
    step set and mandatory flags cannot drift from what production runs."""
    return TestConnectionDefinition.model_validate_json(AZURE_SQL_DEFINITION_JSON.read_text())


def test_seed_includes_get_databases_step():
    step_names = [step.name for step in _azuresql_definition().steps]
    assert "GetDatabases" in step_names


def test_seed_get_databases_step_is_not_mandatory():
    """The step is non-mandatory so a role that can read the connected database
    but not list siblings (single-database mode) still passes Test Connection;
    a tier that rejects the query still surfaces the failure as a warning."""
    get_databases = next(step for step in _azuresql_definition().steps if step.name == "GetDatabases")
    assert get_databases.mandatory is False


def test_every_seed_step_resolves_to_a_check():
    """Drive ``AzureSQLConnection.test_connection`` with the real seed the
    server ships and a mocked engine, so every step runs against the actual
    handler dict ``test_connection_db_common`` builds (``CheckAccess``,
    ``GetSchemas``, ``GetTables``, ``GetViews`` plus the ``GetDatabases`` query
    handler). ``test_connection_steps`` resolves ``step.function`` via
    ``test_fn[step.name]``; a seed step whose handler was removed or renamed
    raises ``KeyError`` *before* any step runs, failing this test -- unlike a
    hand-written dictionary, which would keep passing while real Test
    Connection raised ``KeyError``. Asserts the ran-step set equals the seed
    set, so a missing handler cannot pass silently.
    """
    definition = _azuresql_definition()
    seed_step_names = [step.name for step in definition.steps]

    metadata = MagicMock()
    metadata.get_by_name.return_value = definition

    engine = MagicMock()
    connection = AzureSQLConnection(_config())
    with patch.object(type(connection), "client", new_callable=PropertyMock) as mock_client:
        mock_client.return_value = engine
        result = connection.test_connection(metadata=metadata, timeout_seconds=None)

    ran_step_names = [step.name for step in result.steps]
    assert ran_step_names == seed_step_names, (
        "Every seed step must resolve to a handler in test_connection_db_common; "
        f"a missing handler raises KeyError before any step runs. Seed={seed_step_names}, Ran={ran_step_names}"
    )
