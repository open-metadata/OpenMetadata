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

from metadata.ingestion.source.database.clickhouse.utils import _get_column_type


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
