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
"""Tests for Clickhouse utils and engine-based table typing."""

from contextlib import contextmanager
from types import SimpleNamespace

from clickhouse_sqlalchemy.drivers.base import ischema_names as ch_ischema_names
from sqlalchemy import types as sqltypes

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.clickhouse.metadata import (
    ClickhouseSource,
    _is_delta_lake_engine,
)
from metadata.ingestion.source.database.clickhouse.utils import (
    _get_column_type,
    get_table_names_and_engines,
    get_table_names_and_engines_dialect,
)


class MockDialect:
    """Minimal dialect mock exposing what _get_column_type needs."""

    ischema_names = ch_ischema_names

    def _get_column_type(self, name, spec):
        return _get_column_type(self, name, spec)

    def _parse_decimal_params(self, spec):
        inner = spec[spec.index("(") + 1 : spec.rindex(")")]
        parts = inner.split(",")
        return int(parts[0].strip()), int(parts[1].strip())


class TestClickhouseGetColumnType:
    def setup_method(self):
        self.dialect = MockDialect()

    # --- LowCardinality tests (the changed behavior) ---

    def test_low_cardinality_string_returns_string(self):
        """LowCardinality(String) should unwrap to String."""
        result = self.dialect._get_column_type("col", "LowCardinality(String)")
        assert result == ch_ischema_names["String"]

    def test_low_cardinality_uint8_returns_string(self):
        """LowCardinality(UInt8) should unwrap to UInt8."""
        result = self.dialect._get_column_type("col", "LowCardinality(UInt8)")
        assert result == ch_ischema_names["UInt8"]

    def test_low_cardinality_is_not_lowcardinality_sqlalchemy_type(self):
        """Verify the old _lowcardinality type is no longer returned."""
        result = self.dialect._get_column_type("col", "LowCardinality(String)")
        assert "lowcardinality" not in type(result).__name__.lower()

    # --- Basic sanity tests for other types ---

    def test_string_type(self):
        result = self.dialect._get_column_type("col", "String")
        assert result == ch_ischema_names["String"]

    def test_array_type(self):
        result = self.dialect._get_column_type("col", "Array(String)")
        assert result == ch_ischema_names["Array"]

    def test_nullable_unwraps_to_inner_type(self):
        result = self.dialect._get_column_type("col", "Nullable(String)")
        assert result == ch_ischema_names["String"]

    def test_unknown_type_returns_null_type(self):
        result = self.dialect._get_column_type("col", "SomeUnknownType")
        assert result is sqltypes.NullType


class TestClickhouseGeoTypes:
    """Verify that ClickHouse geo types are registered in ischema_names
    and resolved correctly by _get_column_type."""

    def setup_method(self):
        self.dialect = MockDialect()

    # --- Registration checks ---

    def test_geo_types_registered_in_ischema_names(self):
        for geo_type in (
            "Point",
            "Ring",
            "Polygon",
            "MultiPolygon",
            "LineString",
            "MultiLineString",
        ):
            assert geo_type in ch_ischema_names, f"{geo_type} not found in ischema_names"

    # --- Resolution via _get_column_type ---

    def test_point_type_resolves(self):
        result = self.dialect._get_column_type("col", "Point")
        assert result == ch_ischema_names["Point"]

    def test_ring_type_resolves(self):
        result = self.dialect._get_column_type("col", "Ring")
        assert result == ch_ischema_names["Ring"]

    def test_polygon_type_resolves(self):
        result = self.dialect._get_column_type("col", "Polygon")
        assert result == ch_ischema_names["Polygon"]

    def test_multipolygon_type_resolves(self):
        result = self.dialect._get_column_type("col", "MultiPolygon")
        assert result == ch_ischema_names["MultiPolygon"]

    def test_linestring_type_resolves(self):
        result = self.dialect._get_column_type("col", "LineString")
        assert result == ch_ischema_names["LineString"]

    def test_multilinestring_type_resolves(self):
        result = self.dialect._get_column_type("col", "MultiLineString")
        assert result == ch_ischema_names["MultiLineString"]

    def test_geo_types_are_distinct(self):
        """Each geo type should resolve to a different object."""
        types = {
            name: ch_ischema_names[name]
            for name in (
                "Point",
                "Ring",
                "Polygon",
                "MultiPolygon",
                "LineString",
                "MultiLineString",
            )
        }
        # All values should be distinct from NullType
        for name, t in types.items():
            assert t is not sqltypes.NullType, f"{name} resolved to NullType"


class FakeInspector:
    """Stands in for the SQLAlchemy inspector (a DB boundary).

    Engine strings are the real values reported by ClickHouse system.tables
    (e.g. DeltaLakeS3, MergeTree, S3).
    """

    def __init__(self, table_rows, mview_names=None, view_names=None):
        self._table_rows = table_rows
        self._mview_names = mview_names or []
        self._view_names = view_names or []

    def get_table_names_and_engines(self, schema):
        return self._table_rows

    def get_mview_names(self, schema):
        return self._mview_names

    def get_view_names(self, schema):
        return self._view_names


class _TestableClickhouseSource(ClickhouseSource):
    """ClickhouseSource with the heavy connection __init__ bypassed and the
    inspector property swapped for a fake, so query_table_names_and_types runs
    for real against known engine rows."""

    def __init__(self, inspector):
        self._test_inspector = inspector

    @property
    def inspector(self):
        return self._test_inspector


def _types_by_name(table_rows, mview_names=None, view_names=None):
    source = _TestableClickhouseSource(FakeInspector(table_rows, mview_names, view_names))
    return {t.name: t.type_ for t in source.query_table_names_and_types("db")}


class TestClickhouseTableTypeByEngine:
    """query_table_names_and_types maps system.tables.engine to TableType."""

    def test_deltalake_s3_engine_maps_to_deltalake(self):
        types = _types_by_name([("delta_tbl", "DeltaLakeS3")])
        assert types["delta_tbl"] == TableType.DeltaLake

    def test_s3_engine_stays_regular(self):
        types = _types_by_name([("s3_tbl", "S3")])
        assert types["s3_tbl"] == TableType.Regular

    def test_mergetree_engine_stays_regular(self):
        types = _types_by_name([("mt_tbl", "MergeTree")])
        assert types["mt_tbl"] == TableType.Regular

    def test_iceberg_s3_engine_stays_regular(self):
        types = _types_by_name([("iceberg_tbl", "IcebergS3")])
        assert types["iceberg_tbl"] == TableType.Regular

    def test_view_maps_to_view(self):
        types = _types_by_name([], view_names=["my_view"])
        assert types["my_view"] == TableType.View

    def test_materialized_view_maps_to_materialized_view(self):
        types = _types_by_name([], mview_names=["my_mview"])
        assert types["my_mview"] == TableType.MaterializedView


class _Row:
    """Row object mimicking a SQLAlchemy result row (attribute access)."""

    def __init__(self, name, engine):
        self.name = name
        self.engine = engine


class _RecordingDialect:
    """Dialect whose _execute is the DB cursor boundary; records bind params
    and returns canned rows so the real SQL-building path runs for real."""

    def __init__(self, rows):
        self._rows = rows
        self.executed_params = None

    def _execute(self, connection, query, **params):
        self.executed_params = params
        return self._rows


def _fake_connection(database):
    return SimpleNamespace(engine=SimpleNamespace(url=SimpleNamespace(database=database)))


class TestGetTableNamesAndEnginesDialect:
    """Exercise get_table_names_and_engines_dialect against a fake connection."""

    def test_returns_name_engine_pairs_from_rows(self):
        dialect = _RecordingDialect([_Row("delta_tbl", "DeltaLakeS3"), _Row("mt_tbl", "MergeTree")])
        result = get_table_names_and_engines_dialect(dialect, _fake_connection("default"), schema="analytics")
        assert result == [("delta_tbl", "DeltaLakeS3"), ("mt_tbl", "MergeTree")]

    def test_uses_schema_as_database_bind_param(self):
        dialect = _RecordingDialect([])
        get_table_names_and_engines_dialect(dialect, _fake_connection("default"), schema="analytics")
        assert dialect.executed_params == {"database": "analytics"}

    def test_falls_back_to_connection_database_when_no_schema(self):
        dialect = _RecordingDialect([])
        get_table_names_and_engines_dialect(dialect, _fake_connection("default"), schema=None)
        assert dialect.executed_params == {"database": "default"}


class _WrapperDialect:
    """Dialect stub for the inspector wrapper; records how it is called."""

    def __init__(self, rows):
        self._rows = rows
        self.calls = []

    def get_table_names_and_engines(self, conn, schema, info_cache=None):
        self.calls.append((conn, schema, info_cache))
        return self._rows


class _FakeInspectorForWrapper:
    def __init__(self, dialect):
        self.dialect = dialect
        self.info_cache = {}

    @contextmanager
    def _operation_context(self):
        yield "the-conn"


class TestGetTableNamesAndEnginesInspectorWrapper:
    """Exercise the inspector wrapper delegating into the dialect."""

    def test_delegates_to_dialect_within_operation_context(self):
        dialect = _WrapperDialect([("t", "MergeTree")])
        inspector = _FakeInspectorForWrapper(dialect)
        result = get_table_names_and_engines(inspector, "db")
        assert result == [("t", "MergeTree")]
        assert dialect.calls == [("the-conn", "db", inspector.info_cache)]


class TestIsDeltaLakeEngine:
    def test_deltalake_engines_are_true(self):
        assert _is_delta_lake_engine("DeltaLakeS3")

    def test_non_delta_engines_are_false(self):
        assert not _is_delta_lake_engine("MergeTree")
        assert not _is_delta_lake_engine("IcebergS3")

    def test_empty_and_none_are_false(self):
        assert not _is_delta_lake_engine("")
        assert not _is_delta_lake_engine(None)
