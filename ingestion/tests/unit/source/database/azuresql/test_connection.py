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

import pytest
from sqlalchemy import create_engine

from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    AzureSQLConnection as AzureSQLConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
    TestConnectionDefinition as AzureSQLDefinition,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.azuresql.connection import AzureSQLConnection

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


@pytest.mark.parametrize(
    ("ingest_all", "catalog_available", "passed"),
    [(False, False, True), (True, True, True), (True, False, False)],
)
def test_database_discovery_probe_uses_master_only_in_all_databases_mode(ingest_all, catalog_available, passed):
    metadata = MagicMock()
    metadata.get_by_name.return_value = AzureSQLDefinition.model_validate_json(AZURE_SQL_DEFINITION_JSON.read_text())
    active = create_engine("sqlite://")
    catalog = MagicMock()
    query = catalog.connect.return_value.__enter__.return_value.execute
    query.return_value.scalars.return_value = ["master", "mydb"]
    if not catalog_available:
        query.side_effect = RuntimeError("catalog connection refused")
    config = _config().model_copy(update={"ingestAllDatabases": ingest_all})

    with (
        patch(f"{CONNECTION_MODULE}.create_generic_db_connection", side_effect=[active, catalog]) as mock_engine,
        AzureSQLConnection(config) as connection,
    ):
        result = connection.test_connection(metadata=metadata, timeout_seconds=None)

    step = next(step for step in result.steps if step.name == "GetDatabases")
    assert step.passed is passed
    databases = [call.kwargs["connection"].database for call in mock_engine.call_args_list]
    assert databases == (["mydb", "master"] if ingest_all else ["mydb"])
    if ingest_all:
        assert str(query.call_args.args[0]) == "SELECT name FROM sys.databases WHERE DB_NAME() = 'master' ORDER BY name"
        catalog.dispose.assert_called_once()
