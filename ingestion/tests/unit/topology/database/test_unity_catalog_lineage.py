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

from collections import namedtuple
from datetime import timedelta
from itertools import pairwise
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
from metadata.ingestion.source.database.unitycatalog.lineage import (
    UnitycatalogLineageSource,
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
        "sourceConfig": {"config": {"type": "DatabaseLineage", "queryLogDuration": 1}},
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

LineageRow = namedtuple(
    "LineageRow",
    ["source_table_full_name", "target_table_full_name", "column_pairs"],
)


def _make_table(name: str, fqn: str, columns=None) -> Table:
    return Table(
        id=uuid4(),
        name=EntityName(root=name),
        fullyQualifiedName=FullyQualifiedEntityName(root=fqn),
        columns=columns or [],
    )


def _make_column(name: str, fqn: str) -> Column:
    return Column(
        name=ColumnName(root=name),
        dataType=DataType.STRING,
        fullyQualifiedName=FullyQualifiedEntityName(root=fqn),
    )


@pytest.fixture
def lineage_source():
    with (
        patch("metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource.test_connection"),
        patch("metadata.ingestion.ometa.ometa_api.OpenMetadata") as mock_metadata,
        patch("metadata.ingestion.source.database.unitycatalog.lineage.get_sqlalchemy_connection") as mock_engine,
        patch("metadata.ingestion.source.database.unitycatalog.lineage.get_connection"),
    ):
        config = WorkflowSource.model_validate(MOCK_CONFIG["source"])
        source = UnitycatalogLineageSource(config, mock_metadata)
        source.engine = mock_engine.return_value
        yield source


def _mock_query_rows(lineage_source, rows):
    mock_conn = MagicMock()
    mock_conn.execution_options.return_value.execute.return_value = rows
    mock_conn.execute.return_value = rows
    lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
    lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)
    return mock_conn


class TestResolveChunkDays:
    def test_uses_configured_value(self, lineage_source):
        lineage_source.service_connection.lineageQueryChunkSize = 14

        assert lineage_source._resolve_chunk_days() == 14

    def test_clamps_to_at_least_one(self, lineage_source):
        lineage_source.service_connection.lineageQueryChunkSize = 0

        assert lineage_source._resolve_chunk_days() == 1

    def test_defaults_when_unset(self, lineage_source):
        lineage_source.service_connection.lineageQueryChunkSize = None

        assert lineage_source._resolve_chunk_days() == 7


class TestDateWindows:
    def test_windows_are_contiguous_and_chunk_sized(self, lineage_source):
        lineage_source._chunk_days = 1
        lineage_source.source_config.queryLogDuration = 3

        windows = list(lineage_source._iter_date_windows())

        assert len(windows) == 4
        for window_start, window_end in windows:
            assert window_end - window_start <= timedelta(days=1)
        for prev, curr in pairwise(windows):
            assert prev[1] == curr[0]

    def test_larger_chunk_issues_fewer_windows(self, lineage_source):
        lineage_source._chunk_days = 7
        lineage_source.source_config.queryLogDuration = 30

        windows = list(lineage_source._iter_date_windows())

        assert len(windows) == 5
        for prev, curr in pairwise(windows):
            assert prev[1] == curr[0]

    def test_window_covers_full_lookback(self, lineage_source):
        lineage_source._chunk_days = 1
        lineage_source.source_config.queryLogDuration = 2

        windows = list(lineage_source._iter_date_windows())

        assert windows[-1][1] - windows[0][0] == timedelta(days=3)


class TestResolveTable:
    def test_resolves_and_caches_hit(self, lineage_source):
        source_table = _make_table("source", "local_unitycatalog.cat.schema.source")
        lineage_source.metadata.get_by_name.return_value = source_table

        first = lineage_source._resolve_table("cat.schema.source")
        second = lineage_source._resolve_table("CAT.SCHEMA.SOURCE")

        assert first is source_table
        assert second is source_table
        assert lineage_source.metadata.get_by_name.call_count == 1

    def test_caches_misses(self, lineage_source):
        lineage_source.metadata.get_by_name.return_value = None

        assert lineage_source._resolve_table("cat.schema.missing") is None
        assert lineage_source._resolve_table("cat.schema.missing") is None
        assert lineage_source.metadata.get_by_name.call_count == 1

    def test_malformed_name_not_resolved(self, lineage_source):
        assert lineage_source._resolve_table("not_a_fqn") is None
        lineage_source.metadata.get_by_name.assert_not_called()


class TestColumnPairs:
    def test_parses_json_string(self, lineage_source):
        raw = '[{"u":"col_a","d":"col_x"},{"u":"col_b","d":"col_y"}]'

        assert lineage_source._parse_column_pairs(raw) == [("col_a", "col_x"), ("col_b", "col_y")]

    def test_parses_already_parsed_list(self, lineage_source):
        raw = [{"u": "col_a", "d": "col_x"}]

        assert lineage_source._parse_column_pairs(raw) == [("col_a", "col_x")]

    def test_handles_none_and_malformed(self, lineage_source):
        assert lineage_source._parse_column_pairs(None) == []
        assert lineage_source._parse_column_pairs("not json") == []
        assert lineage_source._parse_column_pairs('[{"u":"only_source"}]') == []


class TestBuildTableEdge:
    def test_builds_edge_without_columns(self, lineage_source):
        source_table = _make_table("source", "local_unitycatalog.cat.schema.source")
        target_table = _make_table("target", "local_unitycatalog.cat.schema.target")
        lineage_source.metadata.get_by_name.side_effect = [source_table, target_table]

        row = LineageRow("cat.schema.source", "cat.schema.target", None)
        edge = lineage_source._build_table_edge(row)

        assert isinstance(edge, AddLineageRequest)
        assert edge.edge.fromEntity.id == source_table.id
        assert edge.edge.toEntity.id == target_table.id

    def test_builds_edge_with_column_lineage(self, lineage_source):
        source_table = _make_table(
            "source",
            "local_unitycatalog.cat.schema.source",
            [_make_column("col_a", "local_unitycatalog.cat.schema.source.col_a")],
        )
        target_table = _make_table(
            "target",
            "local_unitycatalog.cat.schema.target",
            [_make_column("col_x", "local_unitycatalog.cat.schema.target.col_x")],
        )
        lineage_source.metadata.get_by_name.side_effect = [source_table, target_table]

        row = LineageRow("cat.schema.source", "cat.schema.target", '[{"u":"col_a","d":"col_x"}]')
        edge = lineage_source._build_table_edge(row)

        column_lineage = edge.edge.lineageDetails.columnsLineage
        assert len(column_lineage) == 1
        assert column_lineage[0].fromColumns[0].root == "local_unitycatalog.cat.schema.source.col_a"
        assert column_lineage[0].toColumn.root == "local_unitycatalog.cat.schema.target.col_x"

    def test_returns_none_when_target_unresolved(self, lineage_source):
        source_table = _make_table("source", "local_unitycatalog.cat.schema.source")
        lineage_source.metadata.get_by_name.side_effect = [source_table, None]

        row = LineageRow("cat.schema.source", "cat.schema.target", None)

        assert lineage_source._build_table_edge(row) is None

    def test_self_loop_column_dropped(self, lineage_source):
        source_table = _make_table(
            "tbl",
            "local_unitycatalog.cat.schema.tbl",
            [_make_column("col_a", "local_unitycatalog.cat.schema.tbl.col_a")],
        )
        same_table = source_table
        lineage_source.metadata.get_by_name.side_effect = [source_table, same_table]

        row = LineageRow("cat.schema.tbl", "cat.schema.tbl", '[{"u":"col_a","d":"col_a"}]')
        edge = lineage_source._build_table_edge(row)

        assert edge.edge.lineageDetails.columnsLineage is None


class TestYieldTableLineage:
    def test_emits_resolved_edges(self, lineage_source):
        lineage_source.source_config.queryLogDuration = 1
        source_table = _make_table("source", "local_unitycatalog.cat.schema.source")
        target_table = _make_table("target", "local_unitycatalog.cat.schema.target")
        lineage_source.metadata.get_by_name.side_effect = [source_table, target_table, None, None]

        rows = [LineageRow("cat.schema.source", "cat.schema.target", None)]
        with patch.object(lineage_source, "_iter_date_windows", return_value=[("s", "e")]):
            _mock_query_rows(lineage_source, rows)
            results = list(lineage_source._yield_table_lineage())

        assert len(results) == 1
        assert isinstance(results[0].right, AddLineageRequest)

    def test_skips_unresolved_edges(self, lineage_source):
        lineage_source.metadata.get_by_name.return_value = None

        rows = [LineageRow("cat.schema.source", "cat.schema.target", None)]
        with patch.object(lineage_source, "_iter_date_windows", return_value=[("s", "e")]):
            _mock_query_rows(lineage_source, rows)
            results = list(lineage_source._yield_table_lineage())

        assert results == []

    def test_row_failure_yields_left(self, lineage_source):
        rows = [LineageRow("cat.schema.source", "cat.schema.target", None)]
        with (
            patch.object(lineage_source, "_iter_date_windows", return_value=[("s", "e")]),
            patch.object(lineage_source, "_build_table_edge", side_effect=Exception("boom")),
        ):
            _mock_query_rows(lineage_source, rows)
            results = list(lineage_source._yield_table_lineage())

        assert len(results) == 1
        assert results[0].left is not None
        assert results[0].right is None
        assert "boom" in results[0].left.error

    def test_window_failure_yields_left(self, lineage_source):
        mock_conn = MagicMock()
        mock_conn.execution_options.return_value.execute.side_effect = Exception("Access denied")
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        with patch.object(lineage_source, "_iter_date_windows", return_value=[("s", "e")]):
            results = list(lineage_source._yield_table_lineage())

        assert len(results) == 1
        assert results[0].right is None
        assert "Access denied" in results[0].left.error

    def test_filtered_rows_skipped_without_resolution(self, lineage_source):
        rows = [LineageRow("cat.schema.source", "cat.schema.target", None)]
        with (
            patch.object(lineage_source, "_iter_date_windows", return_value=[("s", "e")]),
            patch(
                "metadata.ingestion.source.database.unitycatalog.lineage.filter_by_table",
                return_value=True,
            ),
        ):
            _mock_query_rows(lineage_source, rows)
            results = list(lineage_source._yield_table_lineage())

        assert results == []
        lineage_source.metadata.get_by_name.assert_not_called()

    def test_query_scoped_to_window(self, lineage_source):
        with patch.object(lineage_source, "_iter_date_windows", return_value=[("2026-01-01", "2026-01-02")]):
            mock_conn = _mock_query_rows(lineage_source, [])
            list(lineage_source._yield_table_lineage())

        executed = str(mock_conn.execution_options.return_value.execute.call_args.args[0])
        assert "2026-01-01" in executed
        assert "2026-01-02" in executed
        assert "split_part" not in executed


class TestExternalLocationLineage:
    def test_yields_container_lineage(self, lineage_source):
        ExternalRow = namedtuple(
            "ExternalRow",
            ["table_catalog", "table_schema", "table_name", "storage_path"],
        )
        rows = [ExternalRow("cat", "schema", "ext_table", "s3://bucket/path/")]
        table_entity = _make_table("ext_table", "local_unitycatalog.cat.schema.ext_table")
        container_entity = Container(
            id=uuid4(),
            name=EntityName(root="test_container"),
            service=EntityReference(id=uuid4(), type="storageService"),
        )

        lineage_source.metadata.get_by_name.return_value = table_entity
        lineage_source.metadata.es_search_container_by_path.return_value = [container_entity]
        _mock_query_rows(lineage_source, rows)

        results = list(lineage_source._yield_external_lineage())

        assert len(results) == 1
        assert results[0].right.edge.fromEntity.id == container_entity.id
        assert results[0].right.edge.fromEntity.type == "container"
        assert results[0].right.edge.toEntity.id == table_entity.id
        lineage_source.metadata.es_search_container_by_path.assert_called_once_with(
            full_path="s3://bucket/path", fields="dataModel"
        )

    def test_skips_when_table_not_in_om(self, lineage_source):
        ExternalRow = namedtuple(
            "ExternalRow",
            ["table_catalog", "table_schema", "table_name", "storage_path"],
        )
        rows = [ExternalRow("cat", "schema", "ext_table", "s3://bucket/path")]
        lineage_source.metadata.get_by_name.return_value = None
        _mock_query_rows(lineage_source, rows)

        results = list(lineage_source._yield_external_lineage())

        assert results == []
        lineage_source.metadata.es_search_container_by_path.assert_not_called()

    def test_no_storage_path_yields_nothing(self, lineage_source):
        table_entity = _make_table("test_table", "service.db.schema.test_table")

        results = list(lineage_source._process_external_location_lineage(table_entity, None))

        assert results == []

    def test_no_container_found(self, lineage_source):
        table_entity = _make_table("test_table", "service.db.schema.test_table")
        lineage_source.metadata.es_search_container_by_path.return_value = []

        results = list(lineage_source._process_external_location_lineage(table_entity, "s3://bucket/path"))

        assert results == []

    def test_failure_yields_left(self, lineage_source):
        table_entity = _make_table("test_table", "service.db.schema.test_table")
        lineage_source.metadata.es_search_container_by_path.side_effect = Exception("Search unavailable")

        results = list(lineage_source._process_external_location_lineage(table_entity, "s3://bucket/path"))

        assert len(results) == 1
        assert results[0].left is not None
        assert "Search unavailable" in results[0].left.error

    def test_external_scan_failure_yields_left(self, lineage_source):
        mock_conn = MagicMock()
        mock_conn.execution_options.return_value.execute.side_effect = Exception("Access denied")
        lineage_source.engine.connect.return_value.__enter__ = Mock(return_value=mock_conn)
        lineage_source.engine.connect.return_value.__exit__ = Mock(return_value=False)

        results = list(lineage_source._yield_external_lineage())

        assert len(results) == 1
        assert results[0].right is None
        assert "Access denied" in results[0].left.error


class TestIsFilteredTable:
    def test_filters_by_database(self, lineage_source):
        with patch(
            "metadata.ingestion.source.database.unitycatalog.lineage.filter_by_database",
            return_value=True,
        ):
            assert lineage_source._is_filtered_table("system.schema.tbl") is True

    def test_not_filtered_when_all_patterns_pass(self, lineage_source):
        assert lineage_source._is_filtered_table("cat.schema.tbl") is False

    def test_malformed_name_not_filtered(self, lineage_source):
        assert lineage_source._is_filtered_table("not_a_fqn") is False

    def test_normalizes_case_before_filtering(self, lineage_source):
        seen = []
        with patch(
            "metadata.ingestion.source.database.unitycatalog.lineage.filter_by_schema",
            side_effect=lambda _pattern, name: seen.append(name) or False,
        ):
            lineage_source._is_filtered_table("CAT.MySchema.MyTable")

        assert seen == ["myschema"]


class TestIter:
    def test_chains_table_then_external_lineage(self, lineage_source):
        with (
            patch.object(lineage_source, "_yield_table_lineage", return_value=["t1", "t2"]) as mock_table,
            patch.object(lineage_source, "_yield_external_lineage", return_value=["e1"]) as mock_external,
        ):
            results = list(lineage_source._iter())

        mock_table.assert_called_once_with()
        mock_external.assert_called_once_with()
        assert results == ["t1", "t2", "e1"]

    def test_does_not_enumerate_catalogs(self, lineage_source):
        with (
            patch.object(lineage_source, "_yield_table_lineage", return_value=[]),
            patch.object(lineage_source, "_yield_external_lineage", return_value=[]),
        ):
            list(lineage_source._iter())

        lineage_source.metadata.list_all_entities.assert_not_called()


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
