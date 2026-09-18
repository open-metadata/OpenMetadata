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
"""Oracle reflection keeps the CHAR/BYTE length semantics in the displayed type."""

from importlib import import_module
from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects.oracle.base import OracleDialect


def _column_row(
    name,
    data_type,
    length=None,
    char_used=None,
    precision=None,
    scale=None,
    default_on_null=None,
    identity_options=None,
):
    """A row shaped like ORACLE_GET_COLUMNS returns it."""
    return (
        name,
        data_type,
        length,
        precision,
        scale,
        "Y",
        None,
        None,
        "NO",
        char_used,
        default_on_null,
        identity_options,
    )


# The shape ALL_TAB_COLS.IDENTITY_OPTIONS actually has on a 19c identity column.
IDENTITY_OPTIONS = (
    "ALWAYS,START WITH: 1, INCREMENT BY: 1, MAX_VALUE: 9999999999999999999999999999, "
    "MIN_VALUE: 1, CYCLE_FLAG: N, CACHE_SIZE: 20, ORDER_FLAG: N, SCALE_FLAG: N, "
    "EXTEND_FLAG: N, SESSION_FLAG: N, KEEP_VALUE: N"
)


def _dialect(server_version) -> OracleDialect:
    import_module("metadata.ingestion.source.database.oracle.metadata")
    dialect = OracleDialect()
    dialect.table_prefix = "DBA"  # type: ignore[attr-defined]
    dialect.server_version_info = server_version
    return dialect


def _reflect(rows, server_version=(19, 0)):
    dialect = _dialect(server_version)
    connection = MagicMock()
    connection.execute.return_value = rows
    columns = dialect.get_columns(connection, "my_table", schema="my_schema")
    executed = str(connection.execute.call_args.args[0])
    return columns, executed


@pytest.mark.parametrize(
    ("data_type", "length", "char_used", "expected"),
    [
        # https://github.com/open-metadata/OpenMetadata/issues/18576
        ("VARCHAR2", 10, "C", "VARCHAR2(10 CHAR)"),
        ("VARCHAR2", 10, "B", "VARCHAR2(10)"),
        ("CHAR", 5, "C", "CHAR(5 CHAR)"),
        ("CHAR", 5, "B", "CHAR(5)"),
        # NVARCHAR2/NCHAR are always character based; Oracle never shows the qualifier
        ("NVARCHAR2", 20, "C", "NVARCHAR2(20)"),
        ("NCHAR", 4, "C", "NCHAR(4)"),
        # a NULL CHAR_USED (older catalogs, non-string columns) must not add a suffix
        ("VARCHAR2", 10, None, "VARCHAR2(10)"),
    ],
)
@pytest.mark.parametrize("server_version", [(11, 2), (19, 0)])
def test_char_semantics_are_kept_in_the_displayed_type(data_type, length, char_used, expected, server_version):
    columns, _ = _reflect(
        [_column_row("my_column", data_type, length=length, char_used=char_used)],
        server_version=server_version,
    )

    assert columns[0]["system_data_type"] == expected


def test_char_used_is_selected_from_the_catalog():
    _, executed = _reflect([_column_row("my_column", "VARCHAR2", length=10, char_used="C")])

    assert "col.char_used" in executed


def test_non_string_types_are_unaffected():
    columns, _ = _reflect(
        [
            _column_row("amount", "NUMBER", precision=10, scale=2),
            _column_row("created_at", "TIMESTAMP(6)"),
        ]
    )

    assert [column["system_data_type"] for column in columns] == ["NUMBER(10,2)", "TIMESTAMP(6)"]


def test_identity_columns_are_still_read_from_the_right_position():
    """CHAR_USED was inserted ahead of the identity columns in the select list."""
    columns, _ = _reflect(
        [
            _column_row(
                "id",
                "NUMBER",
                precision=10,
                scale=0,
                default_on_null="NO",
                identity_options=IDENTITY_OPTIONS,
            )
        ]
    )

    assert columns[0]["identity"] == {
        "always": True,
        "on_null": False,
        "start": 1,
        "increment": 1,
        "maxvalue": 9999999999999999999999999999,
        "minvalue": 1,
        "cycle": False,
        "cache": 20,
        "order": False,
    }


def test_columns_still_line_up_before_12c():
    """Pre-12c the identity columns are NULL literals, so CHAR_USED shifts them too."""
    columns, _ = _reflect(
        [_column_row("my_column", "VARCHAR2", length=10, char_used="C")],
        server_version=(11, 2),
    )

    assert columns[0]["system_data_type"] == "VARCHAR2(10 CHAR)"
    assert "identity" not in columns[0]
