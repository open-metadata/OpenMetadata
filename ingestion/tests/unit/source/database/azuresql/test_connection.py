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
from unittest.mock import MagicMock, patch

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
    """Every step in the seed must resolve to a function the Python
    ``test_connection_db_common`` handler supplies, or a Test Connection run
    fails with a ``KeyError`` instead of a meaningful step failure.
    """
    seed_steps = {step.name for step in _azuresql_definition().steps}
    # The keys ``test_connection_db_common`` builds, with the handler's
    # ``queries={"GetDatabases": ...}`` applied. The GetDatabases value is
    # backed by AZURE_SQL_GET_DATABASES (asserted above), so a step by that
    # name resolves to a function.
    test_fn = {
        "CheckAccess": MagicMock(),
        "GetSchemas": MagicMock(),
        "GetTables": MagicMock(),
        "GetViews": MagicMock(),
        "GetDatabases": MagicMock(),
    }
    assert seed_steps.issubset(test_fn.keys()), f"Seed steps with no Python handler: {seed_steps - set(test_fn.keys())}"
