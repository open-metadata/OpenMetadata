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
Tests that dialect-specific @compiles overrides for TimestampAddFn / DatetimeAddFn
produce valid SQL for each engine.

Doris does not accept TIMESTAMP as a CAST target type; it requires DATETIME
(or DATETIMEV2). The generic fallback produces AS TIMESTAMP, so Doris needs
its own override.  This module exercises the compiled SQL without requiring
a live database connection.
"""

import unittest
from unittest import TestCase

from sqlalchemy import literal, text
from sqlalchemy.engine.default import DefaultDialect

from metadata.profiler.orm.functions.datetime import DatetimeAddFn, TimestampAddFn


class _FakeDialect(DefaultDialect):
    """Minimal SQLAlchemy dialect stub — only name matters for @compiles dispatch."""

    supports_statement_cache = True

    def __init__(self, dialect_name: str):
        super().__init__()
        self.name = dialect_name


class TestDatetimeDialectCompilation(TestCase):
    """Verify that TimestampAddFn / DatetimeAddFn compile to dialect-correct SQL."""

    def _compile(self, fn_cls, dialect_name: str, interval: int = 1, unit: str = "DAY") -> str:
        dialect = _FakeDialect(dialect_name)
        fn = fn_cls(literal(interval), text(unit))
        return fn.compile(dialect=dialect).string

    # ── Generic / fallback ────────────────────────────────────────────────────

    def test_generic_timestamp_uses_as_timestamp(self):
        sql = self._compile(TimestampAddFn, "generic")
        self.assertIn("AS TIMESTAMP", sql.upper())

    def test_generic_datetime_uses_as_timestamp(self):
        sql = self._compile(DatetimeAddFn, "generic")
        self.assertIn("AS TIMESTAMP", sql.upper())

    # ── MySQL ─────────────────────────────────────────────────────────────────

    def test_mysql_timestamp_uses_as_datetime(self):
        sql = self._compile(TimestampAddFn, "mysql")
        self.assertIn("AS DATETIME", sql.upper())
        self.assertNotIn("AS TIMESTAMP", sql.upper())

    # ── Doris (pydoris dialect) ───────────────────────────────────────────────

    def test_doris_timestamp_uses_as_datetime(self):
        """
        Doris rejects CAST(... AS TIMESTAMP); it requires CAST(... AS DATETIME).
        Before this fix, Doris fell through to generic_function → AS TIMESTAMP,
        causing 'mismatched input TIMESTAMP' errors on time-partitioned tables.
        """
        sql = self._compile(TimestampAddFn, "pydoris")
        self.assertIn("AS DATETIME", sql.upper(), msg=f"Doris SQL was: {sql}")
        self.assertNotIn("AS TIMESTAMP", sql.upper(), msg=f"Doris SQL was: {sql}")

    def test_doris_datetime_uses_as_datetime(self):
        sql = self._compile(DatetimeAddFn, "pydoris")
        self.assertIn("AS DATETIME", sql.upper(), msg=f"Doris DatetimeAddFn SQL was: {sql}")
        self.assertNotIn("AS TIMESTAMP", sql.upper(), msg=f"Doris DatetimeAddFn SQL was: {sql}")

    def test_doris_timestamp_contains_coalesce_interval(self):
        """Interval value and unit are preserved in the Doris SQL."""
        sql = self._compile(TimestampAddFn, "pydoris", interval=3, unit="HOUR")
        self.assertIn("3", sql)
        self.assertIn("HOUR", sql.upper())


if __name__ == "__main__":
    unittest.main()
