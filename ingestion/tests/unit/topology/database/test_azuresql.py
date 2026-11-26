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
"""Azure SQL database discovery and stale deletion."""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.database import Database
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.azuresql.metadata import AzuresqlSource


@pytest.fixture
def azure_catalog():
    active = MagicMock()
    catalog = MagicMock()
    query = catalog.connect.return_value.__enter__.return_value.execute
    query.return_value.scalars.return_value = ["db_one", "db_two", "master"]
    with (
        patch(
            "metadata.ingestion.source.database.azuresql.connection.create_generic_db_connection",
            side_effect=[active, catalog],
        ) as build_engine,
        patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"),
        patch(
            "metadata.ingestion.source.database.database_service.delete_entity_from_source", return_value=iter(())
        ) as delete,
    ):
        yield build_engine, query, delete


def create_source(ingest_all: bool) -> AzuresqlSource:
    source = AzuresqlSource.create(
        {
            "type": "azuresql",
            "serviceName": "test_azuresql",
            "serviceConnection": {
                "config": {
                    "type": "AzureSQL",
                    "username": "user",
                    "password": "password",
                    "hostPort": "myhost:1433",
                    "database": "db_one",
                    "ingestAllDatabases": ingest_all,
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseMetadata", "markDeletedDatabases": True}},
        },
        MagicMock(spec=OpenMetadata),
    )
    source.context.get().__dict__["database_service"] = "test_azuresql"
    return source


def test_all_databases_walk_uses_the_master_catalog(azure_catalog):
    build_engine, query, _ = azure_catalog
    source = create_source(ingest_all=True)
    try:
        with patch.object(source, "set_inspector") as set_inspector:
            assert list(source.get_database_names()) == ["db_one", "db_two", "master"]
        assert [call.kwargs["database_name"] for call in set_inspector.call_args_list] == [
            "db_one",
            "db_two",
            "master",
        ]
    finally:
        source.close()

    assert [call.kwargs["connection"].database for call in build_engine.call_args_list] == ["db_one", "master"]
    query.assert_called_once()


@pytest.mark.parametrize("ingest_all", [False, True])
def test_database_cleanup_matches_ingestion_scope(azure_catalog, ingest_all):
    build_engine, query, delete = azure_catalog
    source = create_source(ingest_all)
    try:
        list(source.mark_databases_as_deleted())
    finally:
        source.close()

    databases = [call.kwargs["connection"].database for call in build_engine.call_args_list]
    if ingest_all:
        assert databases == ["db_one", "master"]
        query.assert_called_once()
        delete.assert_called_once_with(
            metadata=source.metadata,
            entity_type=Database,
            entity_source_state={"test_azuresql.db_one", "test_azuresql.db_two", "test_azuresql.master"},
            recursive=True,
            params={"service": "test_azuresql"},
        )
    else:
        assert databases == ["db_one"]
        query.assert_not_called()
        delete.assert_not_called()


def test_database_cleanup_aborts_when_master_catalog_is_empty(azure_catalog):
    _, query, delete = azure_catalog
    query.return_value.scalars.return_value = []
    source = create_source(ingest_all=True)

    try:
        with pytest.raises(SourceConnectionException, match="requires a connection to master"):
            list(source.mark_databases_as_deleted())
    finally:
        source.close()

    delete.assert_not_called()
