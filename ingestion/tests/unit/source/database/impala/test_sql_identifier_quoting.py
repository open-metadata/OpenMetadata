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
Schema and view names are enumerated from Impala, so anyone with CREATE rights
there controls them. The Hive Metastore's own `SPECIAL_CHARACTERS_IN_TABLE_NAMES`
array includes a backtick, so a name can carry one.

Impala's lexer (``QuotedIdentifier = `(\\.|[^`])*` ``) treats a backslash as an
escape and has no way to represent a literal backtick, so a name holding either
cannot be safely quoted -- doubling the backtick is not enough, and a name
ending in ``\\`` would escape the closing backtick and break out. Such names are
rejected; benign names are quoted with a single pair of backticks.
"""

import pytest
from impala.sqlalchemy import ImpalaDialect

from metadata.ingestion.source.database.impala.metadata import (
    get_columns,
    get_impala_table_or_view_names,
    get_view_definition,
)


class _FakeResult:
    def __init__(self, rows=()):
        self.rows = rows

    def fetchall(self):
        return self.rows

    def __iter__(self):
        return iter(self.rows)


class _FakeConnection:
    def __init__(self, emitted, rows=()):
        self.emitted = emitted
        self.rows = rows

    def execute(self, clause):
        self.emitted.append(str(clause))
        return _FakeResult(self.rows)


def test_show_create_view_quotes_benign_schema_and_view():
    emitted = []

    get_view_definition(ImpalaDialect(), _FakeConnection(emitted), "vy", schema="dbx")

    assert emitted == ["SHOW CREATE VIEW `dbx`.`vy`"]


def test_show_create_view_quotes_benign_name_without_a_schema():
    emitted = []

    get_view_definition(ImpalaDialect(), _FakeConnection(emitted), "vy")

    assert emitted == ["SHOW CREATE VIEW `vy`"]


@pytest.mark.parametrize("hostile", ["v`y", "v\\"])
def test_show_create_view_rejects_unquotable_names(hostile):
    with pytest.raises(ValueError):
        get_view_definition(ImpalaDialect(), _FakeConnection([]), hostile, schema="db")


def test_describe_formatted_quotes_benign_schema_and_table():
    emitted = []
    # Serves the `show tables` listing and then the `describe formatted` rows.
    connection = _FakeConnection(emitted, [("vy",)])

    get_impala_table_or_view_names(connection, schema="dbx", target_type="view")

    assert emitted[-1] == "describe formatted `dbx`.`vy`"


@pytest.mark.parametrize("hostile", ["v`y", "v\\"])
def test_describe_formatted_rejects_unquotable_table(hostile):
    connection = _FakeConnection([], [(hostile,)])
    with pytest.raises(ValueError):
        get_impala_table_or_view_names(connection, schema="db", target_type="view")


def test_describe_columns_quotes_benign_schema_and_table():
    emitted = []

    get_columns(ImpalaDialect(), _FakeConnection(emitted), "vy", schema="dbx")

    assert emitted == ["DESCRIBE `dbx`.`vy`"]


@pytest.mark.parametrize("hostile", ["v`y", "v\\"])
def test_describe_columns_rejects_unquotable_names(hostile):
    with pytest.raises(ValueError):
        get_columns(ImpalaDialect(), _FakeConnection([]), hostile, schema="db")
