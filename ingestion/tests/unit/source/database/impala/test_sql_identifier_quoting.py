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

`ImpalaDialect.identifier_preparer` cannot be used for this: it sets
`initial_quote` to a backtick but leaves `escape_quote` at `"`, and SQLAlchemy's
`quote_identifier` doubles `escape_quote` -- so it returns the backtick
unescaped. The escape has to be done here.
"""

from impala.sqlalchemy import ImpalaDialect

from metadata.ingestion.source.database.impala.metadata import get_view_definition


class _FakeResult:
    def fetchall(self):
        return []


class _FakeConnection:
    def __init__(self, emitted):
        self.emitted = emitted

    def execute(self, clause):
        self.emitted.append(str(clause))
        return _FakeResult()


def test_show_create_view_escapes_backticks_in_schema_and_view():
    emitted = []

    get_view_definition(ImpalaDialect(), _FakeConnection(emitted), "v`y", schema="db`x")

    assert emitted == ["SHOW CREATE VIEW `db``x`.`v``y`"]


def test_show_create_view_escapes_backticks_without_a_schema():
    emitted = []

    get_view_definition(ImpalaDialect(), _FakeConnection(emitted), "v`y")

    assert emitted == ["SHOW CREATE VIEW `v``y`"]
