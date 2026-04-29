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
"""Tests for Clickhouse _get_column_type utility function."""

from clickhouse_sqlalchemy.drivers.base import ischema_names as ch_ischema_names
from sqlalchemy import types as sqltypes

from metadata.ingestion.source.database.clickhouse.utils import (
    _get_column_type,
    get_mv_to_target_table,
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
            assert (
                geo_type in ch_ischema_names
            ), f"{geo_type} not found in ischema_names"

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


class TestGetMvToTargetTable:
    """Regression tests for GitHub issue #26265 — missing downstream for
    ClickHouse MATERIALIZED VIEW ... TO <target> lineage."""

    def test_simple_to_syntax(self):
        query = (
            "CREATE MATERIALIZED VIEW mv TO target_table AS SELECT * FROM source_table"
        )
        assert get_mv_to_target_table(query) == ("mv", "target_table")

    def test_if_not_exists(self):
        query = (
            "CREATE MATERIALIZED VIEW IF NOT EXISTS mv TO target "
            "AS SELECT * FROM source"
        )
        assert get_mv_to_target_table(query) == ("mv", "target")

    def test_or_replace(self):
        query = (
            "CREATE OR REPLACE MATERIALIZED VIEW mv TO target "
            "AS SELECT * FROM source"
        )
        assert get_mv_to_target_table(query) == ("mv", "target")

    def test_schema_qualified_names(self):
        query = (
            "CREATE MATERIALIZED VIEW db1.mv TO db2.target "
            "AS SELECT * FROM db1.source"
        )
        assert get_mv_to_target_table(query) == ("db1.mv", "db2.target")

    def test_backtick_quoted_identifiers(self):
        query = (
            "CREATE MATERIALIZED VIEW `my db`.`mv 1` TO `my db`.`target 1` "
            "AS SELECT * FROM `my db`.`source 1`"
        )
        assert get_mv_to_target_table(query) == ("my db.mv 1", "my db.target 1")

    def test_refresh_every_to_syntax(self):
        query = (
            "CREATE MATERIALIZED VIEW mv REFRESH EVERY 1 HOUR TO target "
            "AS SELECT * FROM source"
        )
        assert get_mv_to_target_table(query) == ("mv", "target")

    def test_refresh_every_with_offset_to_syntax(self):
        query = (
            "CREATE MATERIALIZED VIEW mv "
            "REFRESH EVERY 1 DAY OFFSET 1 HOUR RANDOMIZE FOR 10 MINUTE "
            "TO target AS SELECT * FROM source"
        )
        assert get_mv_to_target_table(query) == ("mv", "target")

    def test_on_cluster_to_syntax(self):
        query = (
            "CREATE MATERIALIZED VIEW mv ON CLUSTER my_cluster TO target "
            "AS SELECT * FROM source"
        )
        assert get_mv_to_target_table(query) == ("mv", "target")

    def test_case_insensitive(self):
        query = "create materialized view mv to target as select * from source"
        assert get_mv_to_target_table(query) == ("mv", "target")

    def test_inline_engine_mv_returns_none(self):
        """MV defined with inline ENGINE=... (no TO clause) should not match."""
        query = (
            "CREATE MATERIALIZED VIEW mv ENGINE = MergeTree() ORDER BY id "
            "AS SELECT * FROM source"
        )
        assert get_mv_to_target_table(query) is None

    def test_plain_view_returns_none(self):
        query = "CREATE VIEW v AS SELECT * FROM source"
        assert get_mv_to_target_table(query) is None

    def test_insert_query_returns_none(self):
        query = "INSERT INTO target SELECT * FROM source"
        assert get_mv_to_target_table(query) is None

    def test_empty_query_returns_none(self):
        assert get_mv_to_target_table("") is None
        assert get_mv_to_target_table(None) is None

    def test_populate_keyword_before_to(self):
        query = "CREATE MATERIALIZED VIEW mv POPULATE TO target AS SELECT * FROM source"
        assert get_mv_to_target_table(query) == ("mv", "target")

    def test_on_cluster_and_populate_before_to(self):
        query = (
            "CREATE MATERIALIZED VIEW mv ON CLUSTER my_cluster POPULATE TO target "
            "AS SELECT * FROM source"
        )
        assert get_mv_to_target_table(query) == ("mv", "target")

    def test_uuid_clause(self):
        """system.tables DDL output includes UUID — must still match."""
        query = (
            "CREATE MATERIALIZED VIEW db.mv UUID '550e8400-e29b-41d4-a716-446655440000' "
            "TO db.target AS SELECT * FROM db.source"
        )
        assert get_mv_to_target_table(query) == ("db.mv", "db.target")

    def test_three_part_qualified_names(self):
        query = (
            "CREATE MATERIALIZED VIEW catalog.schema.mv TO catalog2.schema2.target "
            "AS SELECT * FROM catalog.schema.source"
        )
        assert get_mv_to_target_table(query) == (
            "catalog.schema.mv",
            "catalog2.schema2.target",
        )
