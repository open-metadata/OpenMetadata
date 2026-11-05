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
Regression tests for the databricks ``get_schema_names`` ``USE CATALOG``
quoting.

Incident: ``DatabricksDialect.get_schema_names`` switched the active Unity
Catalog before listing schemas with ``SHOW SCHEMAS`` by interpolating the
catalog name into a single-quoted SQL *string literal*::

    connection.execute(text(f"USE CATALOG '{kw.get('database')}'"))

For a catalog name containing an apostrophe (e.g. ``o'brien``), legal under
Unity Catalog naming rules, the literal terminated early at the second ``'``
producing lexically invalid SQL (``USE CATALOG 'o'brien'``) that no SQL lexer
can tokenize. The bug did not affect simple alphanumeric names, so it went
undetected by CI.

The sibling ``get_table_names`` / ``get_view_names`` overrides in the same
module already quoted the catalog as a backtick *identifier* via the dialect's
``identifier_preparer.quote_identifier``. The fix aligns ``get_schema_names``
with the sibling sites so the catalog name is emitted as a well-formed
delimited identifier (e.g. ``USE CATALOG `o'brien```) regardless of the
characters it contains.
"""

from unittest.mock import MagicMock

import pytest

from metadata.ingestion.source.database.databricks.metadata import DatabricksDialect


def _make_conn(captured):
    """Build a mock connection that records every executed statement and
    returns an empty row-set for ``SHOW SCHEMAS``."""

    conn = MagicMock()

    def _execute(stmt, *args, **kwargs):
        captured.append(str(stmt))
        return MagicMock(fetchall=list)

    conn.execute.side_effect = _execute
    return conn


class TestDatabricksGetSchemaNamesQuoting:
    """``USE CATALOG`` must quote the catalog as an identifier, not a literal."""

    def setup_method(self):
        self.dialect = DatabricksDialect()

    def test_apostrophe_catalog_is_backtick_quoted_identifier(self):
        """The reported bug: ``o'brien`` must emit a backtick-quoted identifier,
        not a single-quoted string literal that terminates at the apostrophe."""
        captured = []
        self.dialect.get_schema_names(_make_conn(captured), database="o'brien", is_old_version=False)

        assert captured[0] == "USE CATALOG `o'brien`"
        assert captured[-1] == "SHOW SCHEMAS"

    @pytest.mark.parametrize("catalog", ["o'brien", "main", "cat-a-log"])
    def test_use_catalog_matches_sibling_get_table_names(self, catalog):
        """``get_schema_names`` must stay consistent with the sibling
        ``get_table_names`` / ``get_view_names`` overrides, which quote the
        catalog via ``identifier_preparer.quote_identifier``. Diverging again
        (the root cause of this bug) would fail here."""
        schema_captured = []
        self.dialect.get_schema_names(_make_conn(schema_captured), database=catalog, is_old_version=False)

        table_captured = []
        self.dialect.get_table_names(_make_conn(table_captured), db_name=catalog)

        assert schema_captured[0] == table_captured[0]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
