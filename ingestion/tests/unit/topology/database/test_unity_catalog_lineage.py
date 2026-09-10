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
Test Unity Catalog lineage functionality
"""

import json
from collections import namedtuple
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import pytest

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
)
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    Table,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.unitycatalog.lineage import (
    UnitycatalogLineageSource,
)
from metadata.ingestion.source.database.unitycatalog.queries import (
    unity_catalog_native_lineage_query,
)

MOCK_CONFIG = {
    "source": {
        "type": "unitycatalog-lineage",
        "serviceName": "local_unitycatalog",
        "serviceConnection": {
            "config": {
                "type": "UnityCatalog",
                "catalog": "demo-test-cat",
                "databaseSchema": "test-schema",
                "authType": {"token": "test_token"},
                "hostPort": "localhost:443",
                "httpPath": "/sql/1.0/warehouses/test",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseLineage"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "test_token"},
        }
    },
}


TableRow = namedtuple(
    "TableRow",
    [
        "source_table_full_name",
        "source_path",
        "target_table_full_name",
        "target_path",
        "column_pairs",
        "statement_text",
    ],
)
ExternalRow = namedtuple("ExternalRow", ["table_catalog", "table_schema", "table_name", "storage_path"])


def pairs_json(column_pairs):
    """The JSON array `to_json(collect_set(struct(...)))` aggregates an edge's mappings into"""
    if column_pairs is None:
        return None
    return json.dumps([{"source": source, "target": target} for source, target in column_pairs])


def table_row(
    source=None,
    target=None,
    source_path=None,
    target_path=None,
    column_pairs=None,
    statement_text=None,
):
    """A native lineage row: one table edge with its column mappings and its SQL"""
    return TableRow(source, source_path, target, target_path, pairs_json(column_pairs), statement_text)


def stub_rows(lineage_source, rows=(), external_rows=(), probe_error=None):
    """
    Answer every query the connector runs: the query history probe, the external
    location query and the native lineage query.

    Returns the list executed statements are recorded into, so a test can assert what
    was actually asked of the warehouse.
    """
    executed = []

    def execute(statement, *_args, **_kwargs):
        sql = str(statement)
        executed.append(sql)
        if "WHERE 1=0" in sql:
            if probe_error:
                raise probe_error
            return []
        if "information_schema.tables" in sql:
            return external_rows
        return rows

    mock_conn = MagicMock()
    mock_conn.execute.side_effect = execute
    lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
    lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)
    return executed


def resolve_tables(lineage_source, tables):
    """Resolve `catalog.schema.table` names, keyed the way the connector asks for them"""

    def get_by_name(entity=None, fqn=None, **_kwargs):
        return tables.get(str(fqn).split(".", 1)[1] if fqn else None)

    lineage_source.metadata.get_by_name.side_effect = get_by_name


def a_table(name="test_table", columns=None):
    return Table(
        id=uuid4(),
        name=EntityName(root=name),
        fullyQualifiedName=FullyQualifiedEntityName(root=f"service.db.schema.{name}"),
        columns=columns or [],
    )


def a_column(name, column_fqn):
    return Column(
        name=ColumnName(root=name),
        dataType=DataType.STRING,
        fullyQualifiedName=FullyQualifiedEntityName(root=column_fqn),
    )


def a_container(name="test_container", data_model=None):
    return Container(
        id=uuid4(),
        name=EntityName(root=name),
        service=EntityReference(id=uuid4(), type="storageService"),
        dataModel=data_model,
    )


@pytest.fixture
def lineage_source():
    with (
        patch("metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"),
        patch("metadata.ingestion.ometa.ometa_api.OpenMetadata") as mock_metadata,
        patch("metadata.ingestion.source.database.unitycatalog.lineage.create_connection") as mock_create_connection,
    ):
        config = WorkflowSource.model_validate(MOCK_CONFIG["source"])
        source = UnitycatalogLineageSource(config, mock_metadata)
        source.engine = mock_create_connection.return_value.sql.client
        yield source


class TestCacheLineage:
    def test_cache_table_lineage(self, lineage_source):
        stub_rows(
            lineage_source,
            [
                table_row("cat.schema.source1", "cat.schema.target1"),
                table_row("cat.schema.source2", "cat.schema.target1"),
                table_row("cat.schema.source1", "cat.schema.target2"),
            ],
        )

        lineage_source._cache_lineage()

        assert "cat.schema.target1" in lineage_source.table_lineage_map
        assert lineage_source.table_lineage_map["cat.schema.target1"] == {
            "cat.schema.source1",
            "cat.schema.source2",
        }
        assert lineage_source.table_lineage_map["cat.schema.target2"] == {
            "cat.schema.source1",
        }

    def test_cache_column_lineage(self, lineage_source):
        """The mappings of an edge travel on the edge's own row"""
        stub_rows(
            lineage_source,
            [
                table_row(
                    "cat.schema.src",
                    "cat.schema.tgt",
                    column_pairs=[("col_b", "col_y"), ("col_a", "col_x")],
                )
            ],
        )

        lineage_source._cache_lineage()

        key = ("cat.schema.src", "cat.schema.tgt")
        assert key in lineage_source.column_lineage_map
        assert list(lineage_source.column_lineage_map[key]) == [
            ("col_a", "col_x"),
            ("col_b", "col_y"),
        ]

    def test_lineage_is_read_in_a_single_query(self, lineage_source):
        """
        One query returns table edges, column mappings and SQL. A second query per
        result set, or per batch of edges, re-scans the whole lineage window.
        """
        executed = stub_rows(lineage_source, [table_row("cat.schema.src", "cat.schema.tgt")])

        lineage_source._cache_lineage()

        lineage_queries = [sql for sql in executed if "system.access.table_lineage" in sql and "WHERE 1=0" not in sql]
        assert len(lineage_queries) == 1
        assert "system.access.column_lineage" in lineage_queries[0]

    def test_cache_lineage_handles_query_failure(self, lineage_source):
        mock_conn = MagicMock()
        mock_conn.execute.side_effect = Exception("Access denied")
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        lineage_source._cache_lineage()

        assert len(lineage_source.table_lineage_map) == 0
        assert len(lineage_source.column_lineage_map) == 0
        assert len(lineage_source.edge_sql) == 0

    def test_a_row_without_column_pairs_leaves_no_entry_behind(self, lineage_source):
        stub_rows(lineage_source, [table_row("cat.schema.src", "cat.schema.tgt")])

        lineage_source._cache_lineage()

        assert len(lineage_source.column_lineage_map) == 0


class TestNativeLineageSql:
    """The statement that wrote an edge, joined in the same query as the edge itself."""

    def test_sql_is_attached_to_the_edge(self, lineage_source):
        stub_rows(
            lineage_source,
            [
                table_row(
                    "cat.schema.src",
                    "cat.schema.tgt",
                    statement_text="INSERT INTO tgt SELECT * FROM src",
                )
            ],
        )
        lineage_source._cache_lineage()

        target = a_table("tgt")
        resolve_tables(lineage_source, {"cat.schema.src": a_table("src")})

        results = list(lineage_source._process_table_lineage(target, "cat.schema.tgt"))

        assert len(results) == 1
        assert results[0].right.edge.lineageDetails.sqlQuery.root == "INSERT INTO tgt SELECT * FROM src"

    def test_an_edge_without_sql_is_still_emitted(self, lineage_source):
        stub_rows(lineage_source, [table_row("cat.schema.src", "cat.schema.tgt")])
        lineage_source._cache_lineage()

        resolve_tables(lineage_source, {"cat.schema.src": a_table("src")})

        results = list(lineage_source._process_table_lineage(a_table("tgt"), "cat.schema.tgt"))

        assert len(results) == 1
        assert results[0].right.edge.lineageDetails.sqlQuery is None

    def test_one_statement_is_stored_once_for_all_of_its_edges(self, lineage_source):
        """A statement writing many edges must not be held once per edge"""
        statement = "INSERT INTO tgt SELECT * FROM a JOIN b"
        stub_rows(
            lineage_source,
            [
                table_row("cat.schema.a", "cat.schema.tgt", statement_text=statement),
                # the driver hands out an equal but distinct string per row
                table_row("cat.schema.b", "cat.schema.tgt", statement_text=str(statement)),
            ],
        )

        lineage_source._cache_lineage()

        stored = list(lineage_source.edge_sql.values())
        assert len(stored) == 2
        assert stored[0] is stored[1]

    def test_column_mappings_and_sql_ride_the_same_edge(self, lineage_source):
        stub_rows(
            lineage_source,
            [
                table_row(
                    "cat.schema.src",
                    "cat.schema.tgt",
                    column_pairs=[("col_a", "col_x")],
                    statement_text="INSERT INTO tgt SELECT col_a FROM src",
                )
            ],
        )
        lineage_source._cache_lineage()

        target = a_table("tgt", columns=[a_column("col_x", "svc.cat.schema.tgt.col_x")])
        resolve_tables(
            lineage_source,
            {"cat.schema.src": a_table("src", columns=[a_column("col_a", "svc.cat.schema.src.col_a")])},
        )

        results = list(lineage_source._process_table_lineage(target, "cat.schema.tgt"))

        details = results[0].right.edge.lineageDetails
        assert details.sqlQuery.root == "INSERT INTO tgt SELECT col_a FROM src"
        assert details.columnsLineage[0].fromColumns[0].root == "svc.cat.schema.src.col_a"
        assert details.columnsLineage[0].toColumn.root == "svc.cat.schema.tgt.col_x"

    def test_unreadable_query_history_keeps_the_lineage(self, lineage_source):
        """
        A missing grant on system.query.history must cost the SQL text, not the edges,
        so the statement columns and the join are left out of the query entirely.
        """
        executed = stub_rows(
            lineage_source,
            [table_row("cat.schema.src", "cat.schema.tgt")],
            probe_error=Exception("permission denied on system.query.history"),
        )

        lineage_source._cache_lineage()

        lineage_query = next(sql for sql in executed if "table_edges" in sql)
        assert "system.query.history" not in lineage_query
        assert "latest_statement" not in lineage_query
        assert lineage_source.table_lineage_map["cat.schema.tgt"] == {"cat.schema.src"}
        assert len(lineage_source.edge_sql) == 0

    def test_readable_query_history_is_joined(self, lineage_source):
        executed = stub_rows(lineage_source, [table_row("cat.schema.src", "cat.schema.tgt")])

        lineage_source._cache_lineage()

        lineage_query = next(sql for sql in executed if "table_edges" in sql)
        assert "system.query.history" in lineage_query
        assert "latest_statement" in lineage_query

    def test_unreadable_column_pairs_are_skipped(self, lineage_source):
        stub_rows(lineage_source, [TableRow("cat.schema.src", None, "cat.schema.tgt", None, "not json", None)])

        lineage_source._cache_lineage()

        assert lineage_source.table_lineage_map["cat.schema.tgt"] == {"cat.schema.src"}
        assert len(lineage_source.column_lineage_map) == 0


class TestProcessTableLineage:
    def test_process_table_lineage_from_cache(self, lineage_source):
        lineage_source.table_lineage_map = {"cat.schema.target": {"cat.schema.source"}}
        lineage_source.column_lineage_map = {}

        target_table = Table(
            id=uuid4(),
            name=EntityName(root="target"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.target"),
            columns=[],
        )

        source_table = Table(
            id=uuid4(),
            name=EntityName(root="source"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.source"),
            columns=[],
        )

        lineage_source.metadata.get_by_name.return_value = source_table

        results = list(lineage_source._process_table_lineage(target_table, "cat.schema.target"))

        assert len(results) == 1
        assert isinstance(results[0], Either)
        assert isinstance(results[0].right, AddLineageRequest)
        assert results[0].right.edge.fromEntity.id == source_table.id
        assert results[0].right.edge.toEntity.id == target_table.id

    def test_process_table_lineage_with_column_lineage(self, lineage_source):
        lineage_source.table_lineage_map = {"cat.schema.target": {"cat.schema.source"}}
        lineage_source.column_lineage_map = {("cat.schema.source", "cat.schema.target"): {("col_a", "col_x"): None}}

        target_table = Table(
            id=uuid4(),
            name=EntityName(root="target"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.target"),
            columns=[
                Column(
                    name=ColumnName(root="col_x"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.target.col_x"),
                )
            ],
        )

        source_table = Table(
            id=uuid4(),
            name=EntityName(root="source"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.source"),
            columns=[
                Column(
                    name=ColumnName(root="col_a"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.source.col_a"),
                )
            ],
        )

        lineage_source.metadata.get_by_name.return_value = source_table

        results = list(lineage_source._process_table_lineage(target_table, "cat.schema.target"))

        assert len(results) == 1
        lineage_details = results[0].right.edge.lineageDetails
        assert lineage_details is not None
        assert len(lineage_details.columnsLineage) == 1
        assert lineage_details.columnsLineage[0].fromColumns[0].root == "local_unitycatalog.cat.schema.source.col_a"
        assert lineage_details.columnsLineage[0].toColumn.root == "local_unitycatalog.cat.schema.target.col_x"

    def test_process_table_lineage_skips_malformed_names(self, lineage_source):
        lineage_source.table_lineage_map = {"cat.schema.target": {"malformed_name"}}
        lineage_source.column_lineage_map = {}

        target_table = Table(
            id=uuid4(),
            name=EntityName(root="target"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.target"),
            columns=[],
        )

        results = list(lineage_source._process_table_lineage(target_table, "cat.schema.target"))

        assert len(results) == 0

    def test_process_table_lineage_skips_missing_entity(self, lineage_source):
        lineage_source.table_lineage_map = {"cat.schema.target": {"cat.schema.source"}}
        lineage_source.column_lineage_map = {}

        target_table = Table(
            id=uuid4(),
            name=EntityName(root="target"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.target"),
            columns=[],
        )

        lineage_source.metadata.get_by_name.return_value = None

        results = list(lineage_source._process_table_lineage(target_table, "cat.schema.target"))

        assert len(results) == 0


class TestColumnLineageDetails:
    def test_self_loop_prevention(self, lineage_source):
        lineage_source.column_lineage_map = {("cat.schema.src", "cat.schema.tgt"): {("col_a", "col_a"): None}}

        table = Table(
            id=uuid4(),
            name=EntityName(root="tgt"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.tgt"),
            columns=[
                Column(
                    name=ColumnName(root="col_a"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.tgt.col_a"),
                )
            ],
        )

        same_table_as_source = Table(
            id=uuid4(),
            name=EntityName(root="src"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.src"),
            columns=[
                Column(
                    name=ColumnName(root="col_a"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.src.col_a"),
                )
            ],
        )

        result = lineage_source._get_column_lineage_details(
            same_table_as_source, table, "cat.schema.src", "cat.schema.tgt"
        )

        assert result is not None
        assert len(result.columnsLineage) == 1

    def test_no_column_lineage_returns_none(self, lineage_source):
        lineage_source.column_lineage_map = {}

        table = Table(
            id=uuid4(),
            name=EntityName(root="tgt"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.tgt"),
            columns=[],
        )
        from_table = Table(
            id=uuid4(),
            name=EntityName(root="src"),
            fullyQualifiedName=FullyQualifiedEntityName(root="local_unitycatalog.cat.schema.src"),
            columns=[],
        )

        result = lineage_source._get_column_lineage_details(from_table, table, "cat.schema.src", "cat.schema.tgt")

        assert result is None


class TestExternalLocationLineage:
    def test_cache_external_locations(self, lineage_source):
        mock_rows = [
            ExternalRow("cat", "schema", "ext_table1", "s3://bucket/path1"),
            ExternalRow("cat", "schema", "ext_table2", "s3://bucket/path2/"),
        ]

        mock_conn = MagicMock()
        mock_conn.execute.return_value = mock_rows
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        lineage_source._cache_external_locations()

        assert len(lineage_source.external_location_map) == 2
        assert lineage_source.external_location_map["cat.schema.ext_table1"] == "s3://bucket/path1"
        assert lineage_source.external_location_map["cat.schema.ext_table2"] == "s3://bucket/path2/"

    def test_cache_external_locations_handles_failure(self, lineage_source):
        mock_conn = MagicMock()
        mock_conn.execute.side_effect = Exception("Access denied")
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        lineage_source._cache_external_locations()

        assert len(lineage_source.external_location_map) == 0

    def test_process_external_location_lineage_from_cache(self, lineage_source):
        lineage_source.external_location_map = {"cat.schema.test_table": "s3://bucket/path"}

        table_entity = a_table("test_table")
        resolve_tables(lineage_source, {"cat.schema.test_table": table_entity})

        container_entity = Container(
            id=uuid4(),
            name=EntityName(root="test_container"),
            service=EntityReference(id=uuid4(), type="storageService"),
        )

        lineage_source.metadata.es_search_container_by_path.return_value = [container_entity]

        results = list(lineage_source._process_external_location_lineage("cat.schema.test_table"))

        assert len(results) == 1
        assert isinstance(results[0], Either)
        assert isinstance(results[0].right, AddLineageRequest)
        assert results[0].right.edge.fromEntity.id == container_entity.id
        assert results[0].right.edge.fromEntity.type == "container"
        assert results[0].right.edge.toEntity.id == table_entity.id
        assert results[0].right.edge.toEntity.type == "table"

        lineage_source.metadata.es_search_container_by_path.assert_called_once_with(
            full_path="s3://bucket/path", fields="dataModel"
        )

    def test_process_external_location_strips_trailing_slash(self, lineage_source):
        lineage_source.external_location_map = {"cat.schema.test_table": "s3://test-bucket/data/"}

        resolve_tables(lineage_source, {"cat.schema.test_table": a_table("test_table")})

        container_entity = Container(
            id=uuid4(),
            name=EntityName(root="test_container"),
            service=EntityReference(id=uuid4(), type="storageService"),
        )

        lineage_source.metadata.es_search_container_by_path.return_value = [container_entity]

        results = list(lineage_source._process_external_location_lineage("cat.schema.test_table"))

        assert len(results) == 1
        lineage_source.metadata.es_search_container_by_path.assert_called_once_with(
            full_path="s3://test-bucket/data", fields="dataModel"
        )

    def test_process_external_location_no_cache_entry(self, lineage_source):
        lineage_source.external_location_map = {}

        results = list(lineage_source._process_external_location_lineage("cat.schema.test_table"))

        assert len(results) == 0
        lineage_source.metadata.es_search_container_by_path.assert_not_called()

    def test_process_external_location_no_container_found(self, lineage_source):
        """
        Every external table in the metastore reaches here, so one whose storage was
        never ingested must not cost a request to resolve the table itself.
        """
        lineage_source.external_location_map = {"cat.schema.test_table": "s3://bucket/path"}

        lineage_source.metadata.es_search_container_by_path.return_value = []

        results = list(lineage_source._process_external_location_lineage("cat.schema.test_table"))

        assert len(results) == 0
        lineage_source.metadata.get_by_name.assert_not_called()


class TestContainerColumnLineage:
    def test_get_data_model_column_fqn(self, lineage_source):
        data_model = ContainerDataModel(
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    displayName="id",
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(root="service.container.id"),
                ),
                Column(
                    name=ColumnName(root="name"),
                    displayName="name",
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="service.container.name"),
                ),
            ]
        )

        assert lineage_source._get_data_model_column_fqn(data_model, "id") == "service.container.id"
        assert lineage_source._get_data_model_column_fqn(data_model, "name") == "service.container.name"
        assert lineage_source._get_data_model_column_fqn(data_model, "nonexistent") is None
        assert lineage_source._get_data_model_column_fqn(None, "id") is None

    def test_get_container_column_lineage(self, lineage_source):
        data_model = ContainerDataModel(
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    displayName="id",
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(root="service.container.id"),
                ),
                Column(
                    name=ColumnName(root="name"),
                    displayName="name",
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="service.container.name"),
                ),
            ]
        )

        table_entity = Table(
            id=uuid4(),
            name=EntityName(root="test_table"),
            fullyQualifiedName=FullyQualifiedEntityName(root="service.db.schema.test_table"),
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(root="service.db.schema.test_table.id"),
                ),
                Column(
                    name=ColumnName(root="name"),
                    dataType=DataType.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="service.db.schema.test_table.name"),
                ),
            ],
        )

        result = lineage_source._get_container_column_lineage(data_model, table_entity)

        assert result is not None
        assert len(result.columnsLineage) == 2
        assert result.source == LineageSource.ExternalTableLineage
        assert result.columnsLineage[0].fromColumns[0].root == "service.container.id"
        assert result.columnsLineage[0].toColumn.root == "service.db.schema.test_table.id"


class TestPathBasedLineage:
    """
    Databricks records a location read through `delta.`abfss://...`` with no table name
    at all, only source_path. Issue #27561.
    """

    @staticmethod
    def _cache_rows(lineage_source, table_rows):
        stub_rows(lineage_source, table_rows)
        lineage_source._cache_lineage()

    def test_path_source_resolves_to_external_table(self, lineage_source):
        """The scenario reported in the issue"""
        raw_path = "abfss://raw@storage.dfs.core.windows.net/external_table"
        lineage_source.path_to_table_map[raw_path] = {"bronze_ns.deltalake_ns.external_table"}

        self._cache_rows(
            lineage_source,
            [table_row(target="bronze_ns.deltalake_ns.managed_table_ns", source_path=raw_path)],
        )

        assert lineage_source.table_lineage_map["bronze_ns.deltalake_ns.managed_table_ns"] == {
            "bronze_ns.deltalake_ns.external_table"
        }
        assert len(lineage_source.path_lineage_map) == 0

    def test_path_source_matches_despite_trailing_slash_and_scheme_alias(self, lineage_source):
        lineage_source.path_to_table_map["s3://bucket/data"] = {"cat.schema.ext"}

        self._cache_rows(
            lineage_source,
            [
                table_row(target="cat.schema.tgt1", source_path="s3://bucket/data/"),
                table_row(target="cat.schema.tgt2", source_path="s3a://bucket/data"),
            ],
        )

        assert lineage_source.table_lineage_map["cat.schema.tgt1"] == {"cat.schema.ext"}
        assert lineage_source.table_lineage_map["cat.schema.tgt2"] == {"cat.schema.ext"}

    def test_path_shared_by_two_external_tables_yields_both_upstreams(self, lineage_source):
        lineage_source.path_to_table_map["s3://bucket/shared"] = {
            "cat.schema.ext_a",
            "cat.schema.ext_b",
        }

        self._cache_rows(
            lineage_source,
            [table_row(target="cat.schema.tgt", source_path="s3://bucket/shared")],
        )

        assert lineage_source.table_lineage_map["cat.schema.tgt"] == {
            "cat.schema.ext_a",
            "cat.schema.ext_b",
        }

    def test_unresolved_path_is_kept_for_container_lookup(self, lineage_source):
        self._cache_rows(
            lineage_source,
            [table_row(target="cat.schema.tgt", source_path="s3a://bucket/unregistered/")],
        )

        assert len(lineage_source.table_lineage_map) == 0
        assert lineage_source.path_lineage_map["cat.schema.tgt"] == {"s3://bucket/unregistered"}

    def test_target_path_resolves_to_external_table(self, lineage_source):
        """A write addressed by location, e.g. CREATE TABLE ... LOCATION"""
        lineage_source.path_to_table_map["s3://bucket/gold"] = {"cat.schema.gold_ext"}

        self._cache_rows(
            lineage_source,
            [table_row(source="cat.schema.src", target_path="s3://bucket/gold")],
        )

        assert lineage_source.table_lineage_map["cat.schema.gold_ext"] == {"cat.schema.src"}

    def test_path_resolving_back_to_the_target_is_not_a_self_loop(self, lineage_source):
        lineage_source.path_to_table_map["s3://bucket/data"] = {"cat.schema.ext"}

        self._cache_rows(
            lineage_source,
            [table_row(target="cat.schema.ext", source_path="s3://bucket/data")],
        )

        assert len(lineage_source.table_lineage_map) == 0
        assert len(lineage_source.path_lineage_map) == 0

    def test_row_with_neither_name_nor_path_is_ignored(self, lineage_source):
        self._cache_rows(lineage_source, [table_row(target="cat.schema.tgt")])

        assert len(lineage_source.table_lineage_map) == 0
        assert len(lineage_source.path_lineage_map) == 0

    def test_column_lineage_keyed_by_path_resolved_table(self, lineage_source):
        lineage_source.path_to_table_map["s3://bucket/data"] = {"cat.schema.ext"}

        self._cache_rows(
            lineage_source,
            [
                table_row(
                    target="cat.schema.tgt",
                    source_path="s3://bucket/data",
                    column_pairs=[("col_a", "col_x"), ("col_b", "col_y")],
                )
            ],
        )

        assert list(lineage_source.column_lineage_map[("cat.schema.ext", "cat.schema.tgt")]) == [
            ("col_a", "col_x"),
            ("col_b", "col_y"),
        ]

    def test_column_pair_reported_by_both_name_and_path_is_not_duplicated(self, lineage_source):
        """
        One edge arrives twice when Databricks names its source by table on one row
        and by path on another, and both rows resolve to the same pair.
        """
        lineage_source.path_to_table_map["s3://bucket/data"] = {"cat.schema.ext"}

        self._cache_rows(
            lineage_source,
            [
                table_row("cat.schema.ext", "cat.schema.tgt", column_pairs=[("col_a", "col_x")]),
                table_row(
                    target="cat.schema.tgt",
                    source_path="s3://bucket/data",
                    column_pairs=[("col_a", "col_x")],
                ),
            ],
        )

        assert lineage_source.table_lineage_map["cat.schema.tgt"] == {"cat.schema.ext"}
        assert lineage_source.column_lineage_map[("cat.schema.ext", "cat.schema.tgt")] == {("col_a", "col_x"): None}

    def test_cache_external_locations_builds_the_inverse_map(self, lineage_source):
        mock_rows = [
            ExternalRow("cat", "schema", "ext1", "s3://bucket/path1"),
            ExternalRow("cat", "schema", "ext2", "s3a://bucket/path2/"),
            ExternalRow("cat", "schema", "ext3", "s3://bucket/path1"),
            ExternalRow("cat", "schema", "no_path", None),
        ]

        mock_conn = MagicMock()
        mock_conn.execute.return_value = mock_rows
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        lineage_source._cache_external_locations()

        assert lineage_source.path_to_table_map["s3://bucket/path1"] == {
            "cat.schema.ext1",
            "cat.schema.ext3",
        }
        assert lineage_source.path_to_table_map["s3://bucket/path2"] == {"cat.schema.ext2"}
        assert "cat.schema.no_path" not in {
            table for tables in lineage_source.path_to_table_map.values() for table in tables
        }

    def test_process_path_lineage_emits_container_edge(self, lineage_source):
        table_entity = a_table()
        container_entity = a_container()
        lineage_source.path_lineage_map["cat.schema.test_table"] = {"s3://bucket/unregistered"}
        lineage_source.metadata.es_search_container_by_path.return_value = [container_entity]

        results = list(lineage_source._process_path_lineage(table_entity, "cat.schema.test_table"))

        assert len(results) == 1
        assert results[0].right.edge.fromEntity.id == container_entity.id
        assert results[0].right.edge.fromEntity.type == "container"
        assert results[0].right.edge.toEntity.id == table_entity.id
        assert results[0].right.edge.lineageDetails.source == LineageSource.ExternalTableLineage
        lineage_source.metadata.es_search_container_by_path.assert_called_once_with(
            full_path="s3://bucket/unregistered", fields="dataModel"
        )

    def test_process_path_lineage_falls_back_to_the_de_aliased_scheme(self, lineage_source):
        """A container ingested by the S3 connector is stored as s3://, never s3a://"""
        table_entity = a_table()
        container_entity = a_container()
        lineage_source.path_lineage_map["cat.schema.test_table"] = {"s3a://bucket/data"}
        lineage_source.metadata.es_search_container_by_path.side_effect = [[], [container_entity]]

        results = list(lineage_source._process_path_lineage(table_entity, "cat.schema.test_table"))

        assert len(results) == 1
        assert [
            call.kwargs["full_path"] for call in lineage_source.metadata.es_search_container_by_path.call_args_list
        ] == ["s3a://bucket/data", "s3://bucket/data"]

    def test_process_path_lineage_without_a_container_yields_nothing(self, lineage_source):
        lineage_source.path_lineage_map["cat.schema.test_table"] = {"abfss://raw@storage.dfs.core.windows.net/t"}
        lineage_source.metadata.es_search_container_by_path.return_value = []

        results = list(lineage_source._process_path_lineage(a_table(), "cat.schema.test_table"))

        assert len(results) == 0

    def test_process_path_lineage_no_paths_for_table(self, lineage_source):
        results = list(lineage_source._process_path_lineage(a_table(), "cat.schema.test_table"))

        assert len(results) == 0
        lineage_source.metadata.es_search_container_by_path.assert_not_called()

    def test_external_locations_are_cached_before_lineage(self, lineage_source):
        """
        Resolving a path to the table declared over it reads the location map, so
        filling it after the lineage rows would silently resolve nothing.
        """
        calls = []
        lineage_source._cache_external_locations = lambda: calls.append("locations")
        lineage_source._cache_lineage = lambda: calls.append("lineage")

        list(lineage_source._iter())

        assert calls == ["locations", "lineage"]

    def test_process_path_lineage_carries_container_column_lineage(self, lineage_source):
        table_entity = a_table(
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(root="service.db.schema.test_table.id"),
                )
            ]
        )
        container_entity = a_container(
            data_model=ContainerDataModel(
                columns=[
                    Column(
                        name=ColumnName(root="id"),
                        displayName="id",
                        dataType=DataType.INT,
                        fullyQualifiedName=FullyQualifiedEntityName(root="service.container.id"),
                    )
                ]
            )
        )
        lineage_source.path_lineage_map["cat.schema.test_table"] = {"s3://bucket/data"}
        lineage_source.metadata.es_search_container_by_path.return_value = [container_entity]

        results = list(lineage_source._process_path_lineage(table_entity, "cat.schema.test_table"))

        assert len(results) == 1
        details = results[0].right.edge.lineageDetails
        assert details.source == LineageSource.ExternalTableLineage
        assert len(details.columnsLineage) == 1
        assert details.columnsLineage[0].fromColumns[0].root == "service.container.id"
        assert details.columnsLineage[0].toColumn.root == "service.db.schema.test_table.id"

    def test_process_path_lineage_survives_a_failing_container_lookup(self, lineage_source):
        """One unreachable path must not take the rest of the table's lineage down."""
        lineage_source.path_lineage_map["cat.schema.test_table"] = {"s3://bucket/boom"}
        lineage_source.metadata.es_search_container_by_path.side_effect = RuntimeError("elasticsearch down")

        results = list(lineage_source._process_path_lineage(a_table(), "cat.schema.test_table"))

        assert len(results) == 0

    def test_iter_emits_a_path_resolved_edge_end_to_end(self, lineage_source):
        """
        From system-table rows to an AddLineageRequest, the way the workflow runs
        it: the path source resolves to the external table declared over it.
        """
        raw_path = "abfss://raw@storage.dfs.core.windows.net/external_table"
        external_table = "bronze_ns.deltalake_ns.external_table"
        managed_table = "bronze_ns.deltalake_ns.managed_table_ns"

        stub_rows(
            lineage_source,
            rows=[
                table_row(
                    target=managed_table,
                    source_path=raw_path,
                    column_pairs=[("id", "id")],
                    statement_text="CREATE TABLE managed_table_ns AS SELECT id FROM delta.`" + raw_path + "`",
                )
            ],
            external_rows=[ExternalRow("bronze_ns", "deltalake_ns", "external_table", raw_path)],
        )

        target_entity = Table(
            id=uuid4(),
            name=EntityName(root="managed_table_ns"),
            fullyQualifiedName=FullyQualifiedEntityName(root=f"svc.{managed_table}"),
            database=EntityReference(id=uuid4(), type="database", name="bronze_ns"),
            databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name="deltalake_ns"),
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(root=f"svc.{managed_table}.id"),
                )
            ],
        )
        upstream_entity = Table(
            id=uuid4(),
            name=EntityName(root="external_table"),
            fullyQualifiedName=FullyQualifiedEntityName(root=f"svc.{external_table}"),
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    dataType=DataType.INT,
                    fullyQualifiedName=FullyQualifiedEntityName(root=f"svc.{external_table}.id"),
                )
            ],
        )

        resolve_tables(
            lineage_source,
            {managed_table: target_entity, external_table: upstream_entity},
        )
        lineage_source.metadata.es_search_container_by_path.return_value = []

        results = list(lineage_source._iter())

        assert len(results) == 1
        edge = results[0].right.edge
        assert edge.fromEntity.id == upstream_entity.id
        assert edge.toEntity.id == target_entity.id
        assert edge.lineageDetails.columnsLineage[0].fromColumns[0].root == f"svc.{external_table}.id"
        assert edge.lineageDetails.columnsLineage[0].toColumn.root == f"svc.{managed_table}.id"
        assert edge.lineageDetails.sqlQuery.root.startswith("CREATE TABLE managed_table_ns")
        lineage_source.metadata.list_all_entities.assert_not_called()


class TestLineageDrivenIteration:
    """
    The system tables name every table an edge can end at, so those are the tables
    looked up. Walking the whole service instead pages through every table of every
    schema of every catalog to find the few an edge mentions.
    """

    def test_the_service_is_not_walked(self, lineage_source):
        stub_rows(lineage_source, [table_row("cat.schema.src", "cat.schema.tgt")])
        resolve_tables(lineage_source, {"cat.schema.src": a_table("src"), "cat.schema.tgt": a_table("tgt")})

        results = list(lineage_source._iter())

        assert len(results) == 1
        lineage_source.metadata.list_all_entities.assert_not_called()

    def test_targets_cover_lineage_paths_and_external_locations(self, lineage_source):
        lineage_source.table_lineage_map["cat.schema.from_lineage"] = {"cat.schema.src"}
        lineage_source.path_lineage_map["cat.schema.from_path"] = {"s3://bucket/data"}
        lineage_source.external_location_map["cat.schema.external"] = "s3://bucket/ext"

        assert lineage_source._lineage_targets() == [
            "cat.schema.external",
            "cat.schema.from_lineage",
            "cat.schema.from_path",
        ]

    def test_an_upstream_named_by_two_targets_is_resolved_once(self, lineage_source):
        stub_rows(
            lineage_source,
            [
                table_row("cat.schema.src", "cat.schema.tgt1"),
                table_row("cat.schema.src", "cat.schema.tgt2"),
            ],
        )
        resolve_tables(
            lineage_source,
            {
                "cat.schema.src": a_table("src"),
                "cat.schema.tgt1": a_table("tgt1"),
                "cat.schema.tgt2": a_table("tgt2"),
            },
        )

        results = list(lineage_source._iter())

        assert len(results) == 2
        resolved = [call.kwargs["fqn"] for call in lineage_source.metadata.get_by_name.call_args_list]
        assert resolved.count("local_unitycatalog.cat.schema.src") == 1

    def test_a_target_that_was_never_ingested_is_skipped(self, lineage_source):
        stub_rows(lineage_source, [table_row("cat.schema.src", "cat.schema.tgt")])
        resolve_tables(lineage_source, {"cat.schema.src": a_table("src")})

        assert list(lineage_source._iter()) == []

    def test_a_failing_lookup_is_not_cached(self, lineage_source):
        """A transient failure must not blind every later edge naming that table"""
        lineage_source.metadata.get_by_name.side_effect = RuntimeError("connection reset")

        assert lineage_source._get_table_entity("cat.schema.tgt") is None
        assert "cat.schema.tgt" not in lineage_source._table_cache

    def test_filters_apply_to_the_names_the_system_tables_report(self, lineage_source):
        stub_rows(
            lineage_source,
            [
                table_row("cat.schema.src", "excluded_cat.schema.tgt"),
                table_row("cat.schema.src", "cat.excluded_schema.tgt"),
                table_row("cat.schema.src", "cat.schema.excluded_table"),
                table_row("cat.schema.src", "cat.schema.tgt"),
            ],
        )
        resolve_tables(
            lineage_source,
            {
                "cat.schema.src": a_table("src"),
                "excluded_cat.schema.tgt": a_table("tgt"),
                "cat.excluded_schema.tgt": a_table("tgt"),
                "cat.schema.excluded_table": a_table("excluded_table"),
                "cat.schema.tgt": a_table("tgt"),
            },
        )
        lineage_source.source_config.databaseFilterPattern = FilterPattern(excludes=["excluded_cat"])
        lineage_source.source_config.schemaFilterPattern = FilterPattern(excludes=["excluded_schema"])
        lineage_source.source_config.tableFilterPattern = FilterPattern(excludes=["excluded_table"])

        results = list(lineage_source._iter())

        assert len(results) == 1
        assert results[0].right.edge.toEntity.id is not None
        assert lineage_source.status.filtered == [
            {"local_unitycatalog.cat.excluded_schema.tgt": "Schema Filtered Out"},
            {"local_unitycatalog.cat.schema.excluded_table": "Table Filtered Out"},
            {"local_unitycatalog.excluded_cat.schema.tgt": "Catalog Filtered Out"},
        ]


class TestNativeLineageQuery:
    """The single query both system tables and the statement text are read with."""

    def test_both_system_tables_are_read_in_one_query(self):
        query = unity_catalog_native_lineage_query(7, include_query_history=True)

        assert query.count("FROM system.access.table_lineage") == 1
        assert query.count("FROM system.access.column_lineage") == 1
        assert query.count("INTERVAL 7 DAYS") == 4

    def test_column_mappings_join_on_null_safe_equality(self):
        """
        `source_path` is NULL on every edge reported by table name and `=` on NULL
        never matches, so a plain join would drop those edges' column mappings.
        """
        query = unity_catalog_native_lineage_query(1, include_query_history=True)

        join = query.split("LEFT JOIN column_edges")[1].split("LEFT JOIN system.query.history")[0]
        assert join.count("<=>") == 4
        assert " = " not in join

    def test_history_reaches_one_day_further_back_than_lineage(self):
        """A statement that ran just before the oldest lineage day still wrote that edge"""
        query = unity_catalog_native_lineage_query(2, include_query_history=True)

        assert "history.start_time >= current_date() - INTERVAL 3 DAYS" in query

    def test_unusable_statement_text_is_left_out(self):
        query = unity_catalog_native_lineage_query(1, include_query_history=True)

        assert "UPPER(TRIM(history.statement_text)) <> '<REDACTED>'" in query

    def test_without_query_history_the_query_does_not_name_it(self):
        query = unity_catalog_native_lineage_query(1, include_query_history=False)

        assert "system.query.history" not in query
        assert "statement_id" not in query
        assert "CAST(NULL AS STRING) AS statement_text" in query


class TestExternalTablesWithoutLineage:
    def test_an_external_table_with_no_lineage_still_gets_its_container_edge(self, lineage_source):
        stub_rows(
            lineage_source,
            external_rows=[ExternalRow("cat", "schema", "ext", "s3://bucket/data")],
        )
        table_entity = a_table("ext")
        resolve_tables(lineage_source, {"cat.schema.ext": table_entity})
        container_entity = a_container()
        lineage_source.metadata.es_search_container_by_path.return_value = [container_entity]

        results = list(lineage_source._iter())

        assert len(results) == 1
        assert results[0].right.edge.fromEntity.id == container_entity.id
        assert results[0].right.edge.toEntity.id == table_entity.id

    def test_a_table_with_no_upstream_is_never_resolved(self, lineage_source):
        """Resolving it would spend a request per external table in the metastore"""
        stub_rows(
            lineage_source,
            external_rows=[ExternalRow("cat", "schema", "ext", "s3://bucket/data")],
        )
        lineage_source.metadata.es_search_container_by_path.return_value = []

        assert list(lineage_source._iter()) == []
        lineage_source.metadata.get_by_name.assert_not_called()

    def test_an_external_table_that_was_never_ingested_yields_nothing(self, lineage_source):
        lineage_source.external_location_map = {"cat.schema.ext": "s3://bucket/data"}
        lineage_source.metadata.es_search_container_by_path.return_value = [a_container()]
        resolve_tables(lineage_source, {})

        assert list(lineage_source._process_external_location_lineage("cat.schema.ext")) == []

    def test_a_malformed_target_name_is_dropped(self, lineage_source):
        """A name that is not `catalog.schema.table` cannot be resolved or filtered"""
        stub_rows(lineage_source, [table_row("cat.schema.src", "two.parts")])

        assert list(lineage_source._iter()) == []
        lineage_source.metadata.get_by_name.assert_not_called()
