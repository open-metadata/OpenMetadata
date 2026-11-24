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
Schema and table names are enumerated from Trino, so anyone with CREATE rights
there controls them. Verified against Trino 418: `CREATE TABLE
memory.sast_triage."ev""il"` is accepted, and the unescaped form of the
statements below then fails with SYNTAX_ERROR -- or, worse, silently retargets
at another table. Trino escapes a `"` inside a quoted identifier by doubling it.
"""

import contextlib
from unittest.mock import MagicMock

from trino.sqlalchemy.dialect import TrinoDialect

from metadata.ingestion.source.database.trino.metadata import get_view_definition
from metadata.ingestion.source.database.trino.profiler.system_tables_profiler import (
    TrinoStoredStatisticsSource,
)
from metadata.profiler.orm.functions.table_metric_computer import TrinoTableMetricComputer

HOSTILE_TABLE = 'ev"il'
HOSTILE_SCHEMA = 'sch"ema'


class _FakeBind:
    dialect = TrinoDialect()


class _FakeSession:
    """Stands in for the SQLAlchemy Engine/Session boundary only."""

    # Deliberately exposes the dialect only through get_bind(): a SQLAlchemy
    # Session has no `.dialect`, and the profiler's `self.session` is a Session
    # despite its Engine annotation.
    def __init__(self, emitted):
        self.emitted = emitted

    def execute(self, clause, *args):
        self.emitted.append(str(clause))
        return []

    def get_bind(self):
        return _FakeBind()


def test_show_stats_escapes_quotes_in_the_table_name():
    emitted = []
    source = TrinoStoredStatisticsSource.__new__(TrinoStoredStatisticsSource)
    source.session = _FakeSession(emitted)

    # The call raises after the statement is emitted; the statement is what matters.
    with contextlib.suppress(RuntimeError):
        source._get_db_stats(HOSTILE_SCHEMA, HOSTILE_TABLE)

    assert emitted == ['SHOW STATS FOR "sch""ema"."ev""il"']


def test_table_metric_computer_escapes_quotes_in_the_table_name():
    emitted = []
    computer = TrinoTableMetricComputer.__new__(TrinoTableMetricComputer)
    computer._runner = MagicMock()
    computer._runner._session = _FakeSession(emitted)
    computer._schema_name = HOSTILE_SCHEMA
    computer._table_name = HOSTILE_TABLE
    computer._metrics = []

    computer.compute()

    assert emitted == ['SHOW STATS FOR "sch""ema"."ev""il"']


def test_show_create_view_fallback_escapes_quotes():
    """The information_schema path binds parameters; only the SHOW CREATE VIEW
    fallback interpolates the names."""
    emitted = []

    class _Result:
        def scalar(self):
            return None

    class _Connection:
        def execute(self, clause, *args):
            emitted.append(str(clause).strip())
            return _Result()

    dialect = TrinoDialect()
    dialect._get_default_catalog_name = lambda connection: 'cat"alog'

    get_view_definition(dialect, _Connection(), HOSTILE_TABLE, schema=HOSTILE_SCHEMA)

    assert emitted[-1] == 'SHOW CREATE VIEW "cat""alog"."sch""ema"."ev""il"'
