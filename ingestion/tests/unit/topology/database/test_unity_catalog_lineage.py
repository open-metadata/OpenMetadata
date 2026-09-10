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


def a_column(name, column_fqn):
    return Column(
        name=ColumnName(root=name),
        dataType=DataType.STRING,
        fullyQualifiedName=FullyQualifiedEntityName(root=column_fqn),
    )


def a_table(name="test_table", columns=None):
    return Table(
        id=uuid4(),
        name=EntityName(root=name),
        fullyQualifiedName=FullyQualifiedEntityName(root=f"service.db.schema.{name}"),
        columns=columns or [],
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
    mock_conn.execution_options.return_value = mock_conn
    lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
    lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)
    return executed


def resolve_tables(lineage_source, tables):
    """Resolve `catalog.schema.table` names to entities, keyed as the connector asks"""

    def get_by_name(entity=None, fqn=None, **_kwargs):
        return tables.get(str(fqn).split(".", 1)[1]) if fqn else None

    lineage_source.metadata.get_by_name.side_effect = get_by_name


def run(lineage_source, rows=(), tables=None, external_rows=(), probe_error=None):
    """Everything the connector emits for `rows`"""
    stub_rows(lineage_source, rows, external_rows=external_rows, probe_error=probe_error)
    resolve_tables(lineage_source, tables or {})
    return list(lineage_source._iter())


def _entity_names(tables):
    return {str(table.id.root): name for name, table in tables.items()}


def table_edges(results, tables):
    """The emitted table-to-table edges, back in Databricks names"""
    names = _entity_names(tables)
    return sorted(
        (names[str(result.right.edge.fromEntity.id.root)], names[str(result.right.edge.toEntity.id.root)])
        for result in results
        if result.right.edge.fromEntity.type == "table"
    )


def container_edges(results, tables):
    """The emitted container-to-table edges, with the target back in its Databricks name"""
    names = _entity_names(tables)
    return sorted(
        (str(result.right.edge.fromEntity.id.root), names[str(result.right.edge.toEntity.id.root)])
        for result in results
        if result.right.edge.fromEntity.type == "container"
    )


class TestNativeLineageQuery:
    """The single query both system tables and the statement text are read with."""

    def test_both_system_tables_are_read_in_one_query(self):
        query = unity_catalog_native_lineage_query(7, include_query_history=True)

        assert query.count("FROM system.access.table_lineage") == 1
        assert query.count("FROM system.access.column_lineage") == 1
        assert query.count("INTERVAL 7 DAYS") == 4

    def test_rows_are_ordered_by_target(self):
        """The reader emits a target and forgets it, which needs its rows together"""
        query = unity_catalog_native_lineage_query(1, include_query_history=True)

        assert query.rstrip().endswith("ORDER BY table_edges.target_table_full_name, table_edges.target_path")

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


class TestNativeLineageStream:
    """Rows in, lineage out, without holding the catalog in memory."""

    def test_lineage_is_read_in_a_single_query(self, lineage_source):
        """
        One query returns table edges, column mappings and SQL. A second query per
        result set, or per batch of edges, re-scans the whole lineage window.
        """
        executed = stub_rows(lineage_source, [table_row("cat.schema.src", "cat.schema.tgt")])
        resolve_tables(lineage_source, {})

        list(lineage_source._iter())

        lineage_queries = [sql for sql in executed if "system.access.table_lineage" in sql and "WHERE 1=0" not in sql]
        assert len(lineage_queries) == 1
        assert "system.access.column_lineage" in lineage_queries[0]

    def test_every_source_of_every_target_is_emitted(self, lineage_source):
        tables = {
            "cat.schema.source1": a_table("source1"),
            "cat.schema.source2": a_table("source2"),
            "cat.schema.target1": a_table("target1"),
            "cat.schema.target2": a_table("target2"),
        }
        rows = [
            table_row("cat.schema.source1", "cat.schema.target1"),
            table_row("cat.schema.source2", "cat.schema.target1"),
            table_row("cat.schema.source1", "cat.schema.target2"),
        ]

        results = run(lineage_source, rows, tables)

        assert table_edges(results, tables) == [
            ("cat.schema.source1", "cat.schema.target1"),
            ("cat.schema.source1", "cat.schema.target2"),
            ("cat.schema.source2", "cat.schema.target1"),
        ]

    def test_only_the_target_in_hand_is_held(self, lineage_source):
        """
        A target is emitted when the next one appears, so what is buffered is one
        target's edges rather than every edge in the catalog.
        """
        held = []
        tables = {
            "cat.schema.src": a_table("src"),
            "cat.schema.tgt1": a_table("tgt1"),
            "cat.schema.tgt2": a_table("tgt2"),
        }
        stub_rows(
            lineage_source,
            [
                table_row("cat.schema.src", "cat.schema.tgt1"),
                table_row("cat.schema.src", "cat.schema.tgt2"),
            ],
        )
        resolve_tables(lineage_source, tables)

        original = lineage_source._process_target_lineage

        def record(target, upstream_columns, upstream_sql, upstream_paths):
            held.append(len(upstream_columns))
            yield from original(target, upstream_columns, upstream_sql, upstream_paths)

        lineage_source._process_target_lineage = record

        results = list(lineage_source._iter())

        assert len(results) == 2
        assert held == [1, 1]

    def test_column_mappings_of_an_edge_are_emitted_sorted(self, lineage_source):
        """`collect_set` has no order; an unchanged edge should serialize identically"""
        tables = {
            "cat.schema.src": a_table(
                "src", columns=[a_column("col_a", "svc.src.col_a"), a_column("col_b", "svc.src.col_b")]
            ),
            "cat.schema.tgt": a_table(
                "tgt", columns=[a_column("col_x", "svc.tgt.col_x"), a_column("col_y", "svc.tgt.col_y")]
            ),
        }

        results = run(
            lineage_source,
            [table_row("cat.schema.src", "cat.schema.tgt", column_pairs=[("col_b", "col_y"), ("col_a", "col_x")])],
            tables,
        )

        columns_lineage = results[0].right.edge.lineageDetails.columnsLineage
        assert [(pair.fromColumns[0].root, pair.toColumn.root) for pair in columns_lineage] == [
            ("svc.src.col_a", "svc.tgt.col_x"),
            ("svc.src.col_b", "svc.tgt.col_y"),
        ]

    def test_a_query_failure_emits_nothing(self, lineage_source):
        mock_conn = MagicMock()
        mock_conn.execution_options.return_value = mock_conn
        mock_conn.execute.side_effect = Exception("Access denied")
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        assert list(lineage_source._iter()) == []

    def test_unreadable_column_pairs_keep_the_edge(self, lineage_source):
        tables = {"cat.schema.src": a_table("src"), "cat.schema.tgt": a_table("tgt")}
        stub_rows(lineage_source, [TableRow("cat.schema.src", None, "cat.schema.tgt", None, "not json", None)])
        resolve_tables(lineage_source, tables)

        results = list(lineage_source._iter())

        assert table_edges(results, tables) == [("cat.schema.src", "cat.schema.tgt")]
        assert results[0].right.edge.lineageDetails.columnsLineage is None

    def test_a_self_referencing_row_is_not_an_edge(self, lineage_source):
        """
        The system tables record access rather than derivation, so a streaming or CDC
        write legitimately names its target as its own source.
        """
        tables = {"cat.schema.stream": a_table("stream")}

        results = run(lineage_source, [table_row("cat.schema.stream", "cat.schema.stream")], tables)

        assert results == []

    def test_only_the_self_reference_is_dropped(self, lineage_source):
        tables = {"cat.schema.events": a_table("events"), "cat.schema.snapshot": a_table("snapshot")}
        rows = [
            table_row("cat.schema.events", "cat.schema.snapshot"),
            table_row("cat.schema.snapshot", "cat.schema.snapshot"),
        ]

        results = run(lineage_source, rows, tables)

        assert table_edges(results, tables) == [("cat.schema.events", "cat.schema.snapshot")]

    def test_a_malformed_source_name_is_skipped(self, lineage_source):
        tables = {"cat.schema.tgt": a_table("tgt")}

        results = run(lineage_source, [table_row("malformed_name", "cat.schema.tgt")], tables)

        assert results == []

    def test_an_upstream_that_was_never_ingested_is_skipped(self, lineage_source):
        tables = {"cat.schema.tgt": a_table("tgt")}

        results = run(lineage_source, [table_row("cat.schema.src", "cat.schema.tgt")], tables)

        assert results == []


class TestSqlEnrichment:
    """The statement that wrote an edge, joined in the same query as the edge itself."""

    def test_sql_is_attached_to_the_edge(self, lineage_source):
        tables = {"cat.schema.src": a_table("src"), "cat.schema.tgt": a_table("tgt")}

        results = run(
            lineage_source,
            [
                table_row(
                    "cat.schema.src",
                    "cat.schema.tgt",
                    statement_text="INSERT INTO tgt SELECT * FROM src",
                )
            ],
            tables,
        )

        assert results[0].right.edge.lineageDetails.sqlQuery.root == "INSERT INTO tgt SELECT * FROM src"

    def test_an_edge_without_sql_is_still_emitted(self, lineage_source):
        tables = {"cat.schema.src": a_table("src"), "cat.schema.tgt": a_table("tgt")}

        results = run(lineage_source, [table_row("cat.schema.src", "cat.schema.tgt")], tables)

        assert len(results) == 1
        assert results[0].right.edge.lineageDetails.sqlQuery is None
        assert results[0].right.edge.lineageDetails.source == LineageSource.QueryLineage

    def test_column_mappings_and_sql_ride_the_same_edge(self, lineage_source):
        tables = {
            "cat.schema.src": a_table("src", columns=[a_column("col_a", "svc.src.col_a")]),
            "cat.schema.tgt": a_table("tgt", columns=[a_column("col_x", "svc.tgt.col_x")]),
        }

        results = run(
            lineage_source,
            [
                table_row(
                    "cat.schema.src",
                    "cat.schema.tgt",
                    column_pairs=[("col_a", "col_x")],
                    statement_text="INSERT INTO tgt SELECT col_a FROM src",
                )
            ],
            tables,
        )

        details = results[0].right.edge.lineageDetails
        assert details.sqlQuery.root == "INSERT INTO tgt SELECT col_a FROM src"
        assert details.columnsLineage[0].fromColumns[0].root == "svc.src.col_a"
        assert details.columnsLineage[0].toColumn.root == "svc.tgt.col_x"

    def test_unreadable_query_history_keeps_the_lineage(self, lineage_source):
        """
        A missing grant on system.query.history must cost the SQL text, not the edges,
        so the statement columns and the join are left out of the query entirely.
        """
        tables = {"cat.schema.src": a_table("src"), "cat.schema.tgt": a_table("tgt")}
        executed = stub_rows(
            lineage_source,
            [table_row("cat.schema.src", "cat.schema.tgt")],
            probe_error=Exception("permission denied on system.query.history"),
        )
        resolve_tables(lineage_source, tables)

        results = list(lineage_source._iter())

        lineage_query = next(sql for sql in executed if "table_edges" in sql)
        assert "system.query.history" not in lineage_query
        assert "latest_statement" not in lineage_query
        assert table_edges(results, tables) == [("cat.schema.src", "cat.schema.tgt")]
        assert results[0].right.edge.lineageDetails.sqlQuery is None

    def test_readable_query_history_is_joined(self, lineage_source):
        executed = stub_rows(lineage_source, [table_row("cat.schema.src", "cat.schema.tgt")])
        resolve_tables(lineage_source, {})

        list(lineage_source._iter())

        lineage_query = next(sql for sql in executed if "table_edges" in sql)
        assert "system.query.history" in lineage_query
        assert "latest_statement" in lineage_query


class TestColumnLineageDetails:
    def test_self_loop_prevention(self, lineage_source):
        table = a_table("tgt", columns=[a_column("col_a", "local_unitycatalog.cat.schema.tgt.col_a")])
        same_table_as_source = a_table("src", columns=[a_column("col_a", "local_unitycatalog.cat.schema.src.col_a")])

        result = lineage_source._get_column_lineage_details(
            same_table_as_source, table, column_pairs={("col_a", "col_a"): None}
        )

        assert result is not None
        assert len(result.columnsLineage) == 1

    def test_no_column_lineage_returns_none(self, lineage_source):
        result = lineage_source._get_column_lineage_details(a_table("src"), a_table("tgt"), column_pairs={})

        assert result is None


class TestExternalLocationLineage:
    def test_cache_external_locations(self, lineage_source):
        stub_rows(
            lineage_source,
            external_rows=[
                ExternalRow("cat", "schema", "ext_table1", "s3://bucket/path1"),
                ExternalRow("cat", "schema", "ext_table2", "s3://bucket/path2/"),
            ],
        )

        lineage_source._cache_external_locations()

        assert len(lineage_source.external_location_map) == 2
        assert lineage_source.external_location_map["cat.schema.ext_table1"] == "s3://bucket/path1"
        assert lineage_source.external_location_map["cat.schema.ext_table2"] == "s3://bucket/path2/"

    def test_cache_external_locations_handles_failure(self, lineage_source):
        mock_conn = MagicMock()
        mock_conn.execute.side_effect = Exception("Access denied")
        mock_conn.execution_options.return_value = mock_conn
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        lineage_source._cache_external_locations()

        assert len(lineage_source.external_location_map) == 0

    def test_cache_external_locations_builds_the_inverse_map(self, lineage_source):
        stub_rows(
            lineage_source,
            external_rows=[
                ExternalRow("cat", "schema", "ext1", "s3://bucket/path1"),
                ExternalRow("cat", "schema", "ext2", "s3a://bucket/path2/"),
                ExternalRow("cat", "schema", "ext3", "s3://bucket/path1"),
                ExternalRow("cat", "schema", "no_path", None),
            ],
        )

        lineage_source._cache_external_locations()

        assert lineage_source.path_to_table_map["s3://bucket/path1"] == {
            "cat.schema.ext1",
            "cat.schema.ext3",
        }
        assert lineage_source.path_to_table_map["s3://bucket/path2"] == {"cat.schema.ext2"}
        assert "cat.schema.no_path" not in {
            table for tables in lineage_source.path_to_table_map.values() for table in tables
        }

    def test_process_external_location_lineage_from_cache(self, lineage_source):
        lineage_source.external_location_map = {"cat.schema.test_table": "s3://bucket/path"}
        table_entity = a_table("test_table")
        container_entity = a_container()
        resolve_tables(lineage_source, {"cat.schema.test_table": table_entity})
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
        lineage_source.metadata.es_search_container_by_path.return_value = [a_container()]

        results = list(lineage_source._process_external_location_lineage("cat.schema.test_table"))

        assert len(results) == 1
        lineage_source.metadata.es_search_container_by_path.assert_called_once_with(
            full_path="s3://test-bucket/data", fields="dataModel"
        )

    def test_process_external_location_no_cache_entry(self, lineage_source):
        lineage_source.external_location_map = {}

        results = list(lineage_source._process_external_location_lineage("cat.schema.test_table"))

        assert len(results) == 0

    def test_process_external_location_no_container_found(self, lineage_source):
        lineage_source.external_location_map = {"cat.schema.test_table": "s3://bucket/path"}
        lineage_source.metadata.es_search_container_by_path.return_value = []

        results = list(lineage_source._process_external_location_lineage("cat.schema.test_table"))

        assert len(results) == 0
        lineage_source.metadata.get_by_name.assert_not_called()

    def test_external_tables_are_emitted_without_any_lineage_row(self, lineage_source):
        """An external table's container edge does not depend on the system lineage tables"""
        tables = {"cat.schema.ext": a_table("ext")}
        container_entity = a_container()
        lineage_source.metadata.es_search_container_by_path.return_value = [container_entity]

        results = run(
            lineage_source,
            rows=[],
            tables=tables,
            external_rows=[ExternalRow("cat", "schema", "ext", "s3://bucket/ext")],
        )

        assert container_edges(results, tables) == [(str(container_entity.id.root), "cat.schema.ext")]


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
            ]
        )
        table_entity = a_table("test_table", columns=[a_column("id", "service.db.schema.test_table.id")])

        result = lineage_source._get_container_column_lineage(data_model, table_entity)

        assert result is not None
        assert len(result.columnsLineage) == 1
        assert result.source == LineageSource.ExternalTableLineage
        assert result.columnsLineage[0].fromColumns[0].root == "service.container.id"
        assert result.columnsLineage[0].toColumn.root == "service.db.schema.test_table.id"


class TestPathBasedLineage:
    """
    Databricks records a location read through `delta.`abfss://...`` with no table name
    at all, only source_path. Issue #27561.
    """

    def test_path_source_resolves_to_external_table(self, lineage_source):
        """The scenario reported in the issue"""
        raw_path = "abfss://raw@storage.dfs.core.windows.net/external_table"
        tables = {
            "bronze_ns.deltalake_ns.external_table": a_table("external_table"),
            "bronze_ns.deltalake_ns.managed_table_ns": a_table("managed_table_ns"),
        }
        lineage_source.path_to_table_map[raw_path] = {"bronze_ns.deltalake_ns.external_table"}

        results = run(
            lineage_source,
            [table_row(target="bronze_ns.deltalake_ns.managed_table_ns", source_path=raw_path)],
            tables,
        )

        assert table_edges(results, tables) == [
            ("bronze_ns.deltalake_ns.external_table", "bronze_ns.deltalake_ns.managed_table_ns")
        ]

    def test_path_source_matches_despite_trailing_slash_and_scheme_alias(self, lineage_source):
        tables = {
            "cat.schema.ext": a_table("ext"),
            "cat.schema.tgt1": a_table("tgt1"),
            "cat.schema.tgt2": a_table("tgt2"),
        }
        lineage_source.path_to_table_map["s3://bucket/data"] = {"cat.schema.ext"}

        results = run(
            lineage_source,
            [
                table_row(target="cat.schema.tgt1", source_path="s3://bucket/data/"),
                table_row(target="cat.schema.tgt2", source_path="s3a://bucket/data"),
            ],
            tables,
        )

        assert table_edges(results, tables) == [
            ("cat.schema.ext", "cat.schema.tgt1"),
            ("cat.schema.ext", "cat.schema.tgt2"),
        ]

    def test_path_shared_by_two_external_tables_yields_both_upstreams(self, lineage_source):
        tables = {
            "cat.schema.ext_a": a_table("ext_a"),
            "cat.schema.ext_b": a_table("ext_b"),
            "cat.schema.tgt": a_table("tgt"),
        }
        lineage_source.path_to_table_map["s3://bucket/shared"] = {"cat.schema.ext_a", "cat.schema.ext_b"}

        results = run(
            lineage_source,
            [table_row(target="cat.schema.tgt", source_path="s3://bucket/shared")],
            tables,
        )

        assert table_edges(results, tables) == [
            ("cat.schema.ext_a", "cat.schema.tgt"),
            ("cat.schema.ext_b", "cat.schema.tgt"),
        ]

    def test_target_path_resolves_to_external_table(self, lineage_source):
        """A write addressed by location, e.g. CREATE TABLE ... LOCATION"""
        tables = {"cat.schema.src": a_table("src"), "cat.schema.gold_ext": a_table("gold_ext")}
        lineage_source.path_to_table_map["s3://bucket/gold"] = {"cat.schema.gold_ext"}

        results = run(
            lineage_source,
            [table_row(source="cat.schema.src", target_path="s3://bucket/gold")],
            tables,
        )

        assert table_edges(results, tables) == [("cat.schema.src", "cat.schema.gold_ext")]

    def test_path_resolving_back_to_the_target_is_not_a_self_loop(self, lineage_source):
        tables = {"cat.schema.ext": a_table("ext")}
        lineage_source.path_to_table_map["s3://bucket/data"] = {"cat.schema.ext"}

        results = run(
            lineage_source,
            [table_row(target="cat.schema.ext", source_path="s3://bucket/data")],
            tables,
        )

        assert results == []

    def test_row_with_neither_name_nor_path_is_ignored(self, lineage_source):
        tables = {"cat.schema.tgt": a_table("tgt")}

        results = run(lineage_source, [table_row(target="cat.schema.tgt")], tables)

        assert results == []

    def test_column_lineage_keyed_by_path_resolved_table(self, lineage_source):
        tables = {
            "cat.schema.ext": a_table("ext", columns=[a_column("col_a", "svc.ext.col_a")]),
            "cat.schema.tgt": a_table("tgt", columns=[a_column("col_x", "svc.tgt.col_x")]),
        }
        lineage_source.path_to_table_map["s3://bucket/data"] = {"cat.schema.ext"}

        results = run(
            lineage_source,
            [
                table_row(
                    target="cat.schema.tgt",
                    source_path="s3://bucket/data",
                    column_pairs=[("col_a", "col_x")],
                )
            ],
            tables,
        )

        columns_lineage = results[0].right.edge.lineageDetails.columnsLineage
        assert [(pair.fromColumns[0].root, pair.toColumn.root) for pair in columns_lineage] == [
            ("svc.ext.col_a", "svc.tgt.col_x")
        ]

    def test_an_edge_reported_by_both_name_and_path_is_emitted_once(self, lineage_source):
        """
        One edge arrives twice when Databricks names its source by table on one row and
        by path on another. `addLineage` replaces an edge's details, so emitting it
        twice would leave whichever request landed last.
        """
        tables = {
            "cat.schema.ext": a_table("ext", columns=[a_column("col_a", "svc.ext.col_a")]),
            "cat.schema.tgt": a_table(
                "tgt", columns=[a_column("col_x", "svc.tgt.col_x"), a_column("col_y", "svc.tgt.col_y")]
            ),
        }
        lineage_source.path_to_table_map["s3://bucket/data"] = {"cat.schema.ext"}

        results = run(
            lineage_source,
            [
                table_row("cat.schema.ext", "cat.schema.tgt", column_pairs=[("col_a", "col_x")]),
                table_row(target="cat.schema.tgt", source_path="s3://bucket/data", column_pairs=[("col_a", "col_y")]),
            ],
            tables,
        )

        assert table_edges(results, tables) == [("cat.schema.ext", "cat.schema.tgt")]
        columns_lineage = results[0].right.edge.lineageDetails.columnsLineage
        assert [(pair.fromColumns[0].root, pair.toColumn.root) for pair in columns_lineage] == [
            ("svc.ext.col_a", "svc.tgt.col_x"),
            ("svc.ext.col_a", "svc.tgt.col_y"),
        ]

    def test_process_path_lineage_emits_container_edge(self, lineage_source):
        table_entity = a_table()
        container_entity = a_container()
        lineage_source.metadata.es_search_container_by_path.return_value = [container_entity]

        results = list(
            lineage_source._process_path_lineage(table_entity, "cat.schema.test_table", {"s3://bucket/unregistered"})
        )

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
        container_entity = a_container()
        lineage_source.metadata.es_search_container_by_path.side_effect = [[], [container_entity]]

        results = list(lineage_source._process_path_lineage(a_table(), "cat.schema.test_table", {"s3a://bucket/data"}))

        assert len(results) == 1
        assert [
            call.kwargs["full_path"] for call in lineage_source.metadata.es_search_container_by_path.call_args_list
        ] == ["s3a://bucket/data", "s3://bucket/data"]

    def test_process_path_lineage_without_a_container_yields_nothing(self, lineage_source):
        lineage_source.metadata.es_search_container_by_path.return_value = []

        results = list(
            lineage_source._process_path_lineage(
                a_table(), "cat.schema.test_table", {"abfss://raw@storage.dfs.core.windows.net/t"}
            )
        )

        assert len(results) == 0

    def test_process_path_lineage_no_paths_for_table(self, lineage_source):
        results = list(lineage_source._process_path_lineage(a_table(), "cat.schema.test_table", set()))

        assert len(results) == 0
        lineage_source.metadata.es_search_container_by_path.assert_not_called()

    def test_process_path_lineage_carries_container_column_lineage(self, lineage_source):
        table_entity = a_table(columns=[a_column("id", "service.db.schema.test_table.id")])
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
        lineage_source.metadata.es_search_container_by_path.return_value = [container_entity]

        results = list(
            lineage_source._process_path_lineage(table_entity, "cat.schema.test_table", {"s3://bucket/data"})
        )

        assert len(results) == 1
        details = results[0].right.edge.lineageDetails
        assert details.source == LineageSource.ExternalTableLineage
        assert len(details.columnsLineage) == 1
        assert details.columnsLineage[0].fromColumns[0].root == "service.container.id"
        assert details.columnsLineage[0].toColumn.root == "service.db.schema.test_table.id"

    def test_process_path_lineage_survives_a_failing_container_lookup(self, lineage_source):
        """One unreachable path must not take the rest of the table's lineage down."""
        lineage_source.metadata.es_search_container_by_path.side_effect = RuntimeError("elasticsearch down")

        results = list(lineage_source._process_path_lineage(a_table(), "cat.schema.test_table", {"s3://bucket/boom"}))

        assert len(results) == 0

    def test_an_unresolved_path_reaches_the_container_of_its_target(self, lineage_source):
        tables = {"cat.schema.tgt": a_table("tgt")}
        container_entity = a_container()
        lineage_source.metadata.es_search_container_by_path.return_value = [container_entity]

        results = run(
            lineage_source,
            [table_row(target="cat.schema.tgt", source_path="s3a://bucket/unregistered/")],
            tables,
        )

        assert container_edges(results, tables) == [(str(container_entity.id.root), "cat.schema.tgt")]

    def test_iter_emits_a_path_resolved_edge_end_to_end(self, lineage_source):
        """
        From system-table rows to an AddLineageRequest, the way the workflow runs it:
        the path source resolves to the external table declared over it.
        """
        raw_path = "abfss://raw@storage.dfs.core.windows.net/external_table"
        external_table = "bronze_ns.deltalake_ns.external_table"
        managed_table = "bronze_ns.deltalake_ns.managed_table_ns"
        tables = {
            external_table: a_table("external_table", columns=[a_column("id", f"svc.{external_table}.id")]),
            managed_table: a_table("managed_table_ns", columns=[a_column("id", f"svc.{managed_table}.id")]),
        }
        lineage_source.metadata.es_search_container_by_path.return_value = []

        results = run(
            lineage_source,
            rows=[
                table_row(
                    target=managed_table,
                    source_path=raw_path,
                    column_pairs=[("id", "id")],
                    statement_text=f"CREATE TABLE managed_table_ns AS SELECT id FROM delta.`{raw_path}`",
                )
            ],
            tables=tables,
            external_rows=[ExternalRow("bronze_ns", "deltalake_ns", "external_table", raw_path)],
        )

        assert len(results) == 1
        edge = results[0].right.edge
        assert edge.fromEntity.id == tables[external_table].id
        assert edge.toEntity.id == tables[managed_table].id
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
        tables = {"cat.schema.src": a_table("src"), "cat.schema.tgt": a_table("tgt")}

        results = run(lineage_source, [table_row("cat.schema.src", "cat.schema.tgt")], tables)

        assert len(results) == 1
        lineage_source.metadata.list_all_entities.assert_not_called()

    def test_an_upstream_named_by_two_targets_is_resolved_once(self, lineage_source):
        tables = {
            "cat.schema.src": a_table("src"),
            "cat.schema.tgt1": a_table("tgt1"),
            "cat.schema.tgt2": a_table("tgt2"),
        }

        results = run(
            lineage_source,
            [
                table_row("cat.schema.src", "cat.schema.tgt1"),
                table_row("cat.schema.src", "cat.schema.tgt2"),
            ],
            tables,
        )

        assert len(results) == 2
        resolved = [call.kwargs["fqn"] for call in lineage_source.metadata.get_by_name.call_args_list]
        assert resolved.count("local_unitycatalog.cat.schema.src") == 1

    def test_a_failing_lookup_is_not_cached(self, lineage_source):
        """A transient failure must not blind every later edge naming that table"""
        lineage_source.metadata.get_by_name.side_effect = RuntimeError("connection reset")

        assert lineage_source._get_table_entity("cat.schema.tgt") is None
        assert "cat.schema.tgt" not in lineage_source._table_cache

    def test_filters_apply_to_the_names_the_system_tables_report(self, lineage_source):
        tables = {
            "cat.schema.src": a_table("src"),
            "excluded_cat.schema.tgt": a_table("tgt"),
            "cat.excluded_schema.tgt": a_table("tgt"),
            "cat.schema.excluded_table": a_table("excluded_table"),
            "cat.schema.tgt": a_table("tgt"),
        }
        lineage_source.source_config.databaseFilterPattern = FilterPattern(excludes=["excluded_cat"])
        lineage_source.source_config.schemaFilterPattern = FilterPattern(excludes=["excluded_schema"])
        lineage_source.source_config.tableFilterPattern = FilterPattern(excludes=["excluded_table"])

        results = run(
            lineage_source,
            [
                table_row("cat.schema.src", "cat.excluded_schema.tgt"),
                table_row("cat.schema.src", "cat.schema.excluded_table"),
                table_row("cat.schema.src", "cat.schema.tgt"),
                table_row("cat.schema.src", "excluded_cat.schema.tgt"),
            ],
            tables,
        )

        assert table_edges(results, tables) == [("cat.schema.src", "cat.schema.tgt")]
        assert lineage_source.status.filtered == [
            {"local_unitycatalog.cat.excluded_schema.tgt": "Schema Filtered Out"},
            {"local_unitycatalog.cat.schema.excluded_table": "Table Filtered Out"},
            {"local_unitycatalog.excluded_cat.schema.tgt": "Catalog Filtered Out"},
        ]

    def test_a_filtered_table_is_reported_once(self, lineage_source):
        """An external table that is also a lineage target is one entry in the summary"""
        lineage_source.source_config.tableFilterPattern = FilterPattern(excludes=["ext"])

        run(
            lineage_source,
            rows=[table_row("cat.schema.src", "cat.schema.ext")],
            external_rows=[ExternalRow("cat", "schema", "ext", "s3://bucket/ext")],
        )

        assert lineage_source.status.filtered == [{"local_unitycatalog.cat.schema.ext": "Table Filtered Out"}]

    def test_external_locations_are_cached_before_lineage(self, lineage_source):
        """
        Resolving a path to the table declared over it reads the location map, so
        filling it after the lineage rows would silently resolve nothing.
        """
        calls = []

        def cache_locations():
            calls.append("locations")

        def stream_lineage():
            calls.append("lineage")
            return iter(())

        lineage_source._cache_external_locations = cache_locations
        lineage_source._stream_native_lineage = stream_lineage

        list(lineage_source._iter())

        assert calls == ["locations", "lineage"]
