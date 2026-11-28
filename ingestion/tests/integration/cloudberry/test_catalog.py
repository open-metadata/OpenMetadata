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
"""Run against a Cloudberry instance initialized with cloudberry_catalog.sql."""

from pathlib import Path
from unittest.mock import Mock
from uuid import uuid4

import pytest

from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
    TestConnectionDefinition,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import StatusType
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.cloudberry.lineage import CloudberryLineageSource
from metadata.ingestion.source.database.cloudberry.metadata import CloudberrySource
from metadata.ingestion.source.models import TableView
from metadata.utils.service_spec.service_spec import import_source_class


@pytest.fixture
def metadata_client():
    root = Path(__file__).resolve().parents[4]
    definition = TestConnectionDefinition.model_validate_json(
        (
            root / "openmetadata-service/src/main/resources/json/data/testConnections/database/cloudberry.json"
        ).read_text()
    )
    client = Mock(spec=OpenMetadata)
    client.es_search_from_fqn.return_value = []
    client.get_by_name.side_effect = lambda entity, fqn: (
        definition if entity is TestConnectionDefinition and fqn == "Cloudberry.testConnectionDefinition" else None
    )
    return client


def test_cloudberry_reflects_the_catalog(source_config, metadata_client):
    source_type = import_source_class(ServiceType.Database, "cloudberry")
    assert source_type is CloudberrySource
    source = source_type.create(source_config, metadata_client)
    try:
        result = source._connection.test_connection(metadata_client)
        assert result.status is StatusType.Successful
        assert len(result.steps) == 5
        assert all(step.passed for step in result.steps)
        assert list(source.get_database_names()) == ["om_cloudberry"]
        assert "warehouse" in source.get_raw_database_schema_names()
        assert "gp_toolkit" not in source.get_raw_database_schema_names()
        source.context.get().upsert("database_service", "cloudberry_test")
        source.context.get().upsert("database", "om_cloudberry")
        source.context.get().upsert("database_schema", "warehouse")

        tables = list(source.get_tables_name_and_type())
        assert dict(tables) == {
            "base": TableType.Regular,
            "events": TableType.Partitioned,
            "ext_events": TableType.External,
            "foreign_events": TableType.Foreign,
            "plain_view": TableType.View,
            "mat_view": TableType.MaterializedView,
        }

        emitted = {}
        for table in tables:
            [result] = list(source.yield_table(table))
            assert result.left is None, result.left
            emitted[table[0]] = result.right
        assert [column.name.root for column in emitted["events"].columns] == ["id", "event_date", "payload"]
        assert emitted["events"].tablePartition.columns[0].columnName == "event_date"
        assert emitted["base"].description.root == "Cloudberry source table"
        assert "warehouse.base" in emitted["plain_view"].schemaDefinition.root
        assert "warehouse.base" in emitted["mat_view"].schemaDefinition.root
    finally:
        source.close()

    source_config["type"] = "cloudberry-lineage"
    source_config["sourceConfig"]["config"] = {"type": "DatabaseLineage", "processQueryLineage": False}
    catalog = {
        name: Table(
            id=uuid4(),
            name=name,
            fullyQualifiedName=f"cloudberry_test.om_cloudberry.warehouse.{name}",
            serviceType=DatabaseServiceType.Cloudberry,
            columns=table.columns,
        )
        for name, table in emitted.items()
    }
    by_fqn = {table.fullyQualifiedName.root: table for table in catalog.values()}
    metadata_client.get_by_name.side_effect = lambda entity, fqn, **_: by_fqn.get(fqn)
    metadata_client.es_search_from_fqn.side_effect = lambda entity_type, fqn_search_string, **_: (
        [table] if entity_type is Table and (table := by_fqn.get(fqn_search_string)) else []
    )
    metadata_client.yield_es_view_def.return_value = [
        TableView(
            table_name=name,
            schema_name="warehouse",
            db_name="om_cloudberry",
            view_definition=emitted[name].schemaDefinition.root,
        )
        for name in ("plain_view", "mat_view")
    ]
    lineage_type = import_source_class(ServiceType.Database, "cloudberry-lineage")
    assert lineage_type is CloudberryLineageSource
    lineage = lineage_type.create(source_config, metadata_client)
    try:
        edges = set()
        for result in lineage.yield_view_lineage():
            assert result.left is None, result.left
            edge = result.right.lineage_request
            edges.add((edge.from_entity_fqn, edge.to_entity_fqn))
        assert edges == {
            (catalog["base"].fullyQualifiedName.root, catalog[name].fullyQualifiedName.root)
            for name in ("plain_view", "mat_view")
        }
    finally:
        lineage.close()


def test_cloudberry_discovers_and_switches_databases(source_config, metadata_client):
    source_config["serviceConnection"]["config"]["ingestAllDatabases"] = True
    source_config["sourceConfig"]["config"]["databaseFilterPattern"] = {"includes": ["^om_cloudberry"]}
    source = CloudberrySource.create(source_config, metadata_client)
    try:
        source.context.get().upsert("database_service", "cloudberry_test")
        assert [
            (database, source.connection.exec_driver_sql("SELECT current_database()").scalar_one())
            for database in source.get_database_names()
        ] == [
            ("om_cloudberry", "om_cloudberry"),
            ("om_cloudberry_second", "om_cloudberry_second"),
        ]
    finally:
        source.close()
