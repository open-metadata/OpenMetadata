#  Copyright 2026 Collate
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
Regression tests for the databricks `get_columns` override.

Incident: DESCRIBE TABLE EXTENDED on Unity Catalog / DSv2 tables (streaming,
Iceberg, foreign tables, and others handled by Spark's ``DescribeTableExec``)
emits section markers not present in the connector's historical whitelist —
notably ``# Metadata Columns`` which appears BEFORE ``# Detailed Table
Information``. Upstream ``_get_column_rows`` normalizes the empty col_type
cell on those marker rows to ``None`` and the column-name-only filter lets
them survive. ``get_columns`` then called ``re.search(r"^\\w+", col_type)``
on ``None`` and raised ``TypeError: expected string or bytes-like object``.
``sql_column_handler`` swallowed the exception and returned zero columns,
which the topology runner treated as "no change" — silently dropping column
metadata for every affected table.

The fix generalizes the loop's end-of-columns detection: any row whose
col_name starts with ``#`` or whose col_type is empty terminates the columns
block. This matches Spark's emission order for both v1 (``DescribeTableCommand``)
and v2 (``DescribeTableExec``) paths without hardcoding a marker list.
"""

from unittest.mock import Mock, patch

import pytest

from metadata.ingestion.source.database.databricks.metadata import get_columns


@patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
class TestDatabricksGetColumnsSectionBoundary:
    """End-of-columns detection: generic '#'-prefix and empty col_type break."""

    def setup_method(self):
        self.mock_self = Mock()
        self.mock_connection = Mock()

    def _run(self):
        return get_columns(
            self.mock_self,
            self.mock_connection,
            "t",
            "s",
            db_name="db",
        )

    def test_unknown_hash_marker_before_detailed_info_breaks_loop(self, mock_rows):
        """DescribeTableExec emits (``# Metadata Columns``) appears before
        ``# Detailed Table Information`` with empty col_type. Without the fix
        the loop reaches ``re.search`` on None and raises TypeError. With the
        fix the loop breaks at the marker."""
        mock_rows.return_value = [
            ("id", "bigint", None),
            ("name", "string", None),
            ("# Metadata Columns", None, None),
            ("_metadata", "struct<...>", None),
            ("# Detailed Table Information", None, None),
            ("Catalog", "my_catalog", None),
            ("Location", "s3://...", None),
        ]

        result = self._run()

        assert [col["name"] for col in result] == ["id", "name"]
        assert [col["ordinal_position"] for col in result] == [0, 1]

    def test_empty_col_type_breaks_loop(self, mock_rows):
        """Exact shape of the prod crash row: non-empty col_name, col_type=None."""
        mock_rows.return_value = [
            ("id", "bigint", None),
            ("weird_marker_row", None, None),
            ("should_not_appear", "string", None),
        ]

        result = self._run()

        assert [col["name"] for col in result] == ["id"]

    def test_empty_string_col_type_breaks_loop(self, mock_rows):
        """``_get_column_rows`` normalizes empty strings to None, but guard
        defensively against either shape reaching the loop."""
        mock_rows.return_value = [
            ("id", "bigint", None),
            ("weird_marker_row", "", None),
        ]

        result = self._run()

        assert [col["name"] for col in result] == ["id"]

    def test_known_whitelisted_markers_still_break(self, mock_rows):
        """Regression: previously whitelisted markers continue to terminate the
        columns block."""
        for marker in (
            "# Partition Information",
            "# Partitioning",
            "# Clustering Information",
            "# Delta Statistics Columns",
            "# Detailed Table Information",
            "# Delta Uniform Iceberg",
        ):
            mock_rows.return_value = [
                ("id", "int", None),
                (marker, None, None),
                ("must_not_leak", "string", None),
            ]

            result = self._run()

            assert [col["name"] for col in result] == [
                "id"
            ], f"marker {marker!r} should break the loop"

    def test_detailed_info_metadata_rows_are_not_treated_as_columns(self, mock_rows):
        """Post-break, rows like ``Name``, ``Catalog``, ``Location`` inside
        ``# Detailed Table Information`` (which have non-empty col_type — a
        path, catalog name, etc.) must not be emitted as fake columns."""
        mock_rows.return_value = [
            ("id", "bigint", None),
            ("# Detailed Table Information", None, None),
            ("Name", "my_catalog.my_schema.my_table", None),
            ("Location", "s3://bucket/path", None),
            ("Provider", "delta", None),
            ("Owner", "user@example.com", None),
        ]

        result = self._run()

        assert [col["name"] for col in result] == ["id"]

    def test_ordinal_positions_are_contiguous_when_loop_breaks_early(self, mock_rows):
        """Ordinal positions stay contiguous and match the column order in
        Databricks when the loop breaks at a section marker."""
        mock_rows.return_value = [
            ("first", "bigint", None),
            ("second", "string", None),
            ("third", "int", None),
            ("# Metadata Columns", None, None),
            ("_metadata", "struct<...>", None),
        ]

        result = self._run()

        assert [col["ordinal_position"] for col in result] == [0, 1, 2]

    def test_ordinal_positions_contiguous_when_a_column_is_skipped(self, mock_rows):
        """If a row fails per-column processing (e.g. unparseable col_type),
        surviving columns keep contiguous ordinal positions — no gaps."""
        mock_rows.return_value = [
            ("good1", "bigint", None),
            ("unparseable", "<weird>", None),
            ("good2", "string", None),
            ("good3", "int", None),
        ]

        result = self._run()

        assert [col["name"] for col in result] == ["good1", "good2", "good3"]
        assert [col["ordinal_position"] for col in result] == [0, 1, 2]

    def test_unexpected_exception_in_row_does_not_drop_other_columns(self, mock_rows):
        """Broad per-row try/except ensures one bad column doesn't lose the
        rest of the table's columns via the outer sql_column_handler catch.

        A ``struct<>`` column triggers the complex-type subquery path. Forcing
        ``connection.execute`` to raise a ``RuntimeError`` (not caught by the
        inner ``(DatabaseError, KeyError)`` handler) bubbles to the outer
        ``except Exception``, which should skip the bad column and continue
        processing subsequent rows."""
        mock_rows.return_value = [
            ("good1", "bigint", None),
            ("complex_col", "struct<a:int>", None),
            ("good2", "string", None),
        ]
        self.mock_connection.execute.side_effect = RuntimeError(
            "simulated subquery failure"
        )

        result = self._run()

        names = [col["name"] for col in result]
        assert "good1" in names
        assert "good2" in names
        assert "complex_col" not in names


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
