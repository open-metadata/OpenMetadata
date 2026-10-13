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
Unit tests for the shared SQL column handler.
"""

from contextlib import contextmanager

import pytest
from sqlalchemy import create_engine

from metadata.ingestion.source.database.sql_column_handler import SqlColumnHandlerMixin


class _Source(SqlColumnHandlerMixin):
    """Bare host for the mixin: the sampler only needs `self.engine`."""


def _sampling_source(engine_url: str, rows: list | None = None):
    """
    Source whose engine records every statement instead of sending it.

    Only the connection is stubbed, so the statements are the ones the real
    sampler builds and compiles through the real dialect. With `rows=None`
    each attempt fails, which is what makes the sampler fall through to its
    text() fallback and lets us capture both statements.
    """
    engine = create_engine(engine_url)
    recorded: list[str] = []

    class _RecordingConnection:
        def execute(self, statement, params=None):
            recorded.append(str(statement.compile(dialect=engine.dialect)))
            if rows is None:
                raise RuntimeError("statement recorded, not sent")
            return _Result()

    class _Result:
        @staticmethod
        def fetchall():
            return rows

    @contextmanager
    def _connect():
        yield _RecordingConnection()

    engine.connect = _connect
    source = _Source()
    source.engine = engine
    return source, recorded


CLICKHOUSE_URL = "clickhouse+http://user:pass@localhost:8123/default"
MYSQL_URL = "mysql+pymysql://user:pass@localhost:3306/default"


@pytest.mark.parametrize("engine_url", [CLICKHOUSE_URL, MYSQL_URL])
def test_sampling_does_not_prefix_the_openmetadata_database(engine_url):
    """
    Connectors with no database layer of their own report the synthetic OM
    database ("default"), which is not a name the source can be queried with.
    Prefixing it produced `FROM "default.bi".events` and `FROM "default".bi.events`,
    both of which the source rejects. The engine is already bound to the database
    being ingested, so the table is addressed as schema.table.
    """
    source, recorded = _sampling_source(engine_url)

    source._sample_json_column_data(
        schema_name="bi",
        table_name="events",
        column_names=["payload"],
        sample_size=10,
    )

    assert len(recorded) == 2, "expected the select attempt and the text() fallback"
    for statement in recorded:
        assert "default" not in statement, f"OM database leaked into the statement: {statement}"
        assert "bi.events" in statement.replace("`", "").replace('"', "")


def test_sampling_returns_rows_keyed_by_column():
    source, recorded = _sampling_source(CLICKHOUSE_URL, rows=[("{}",), (None,), ('{"a": 1}',)])

    sampled = source._sample_json_column_data(
        schema_name="bi",
        table_name="events",
        column_names=["payload"],
        sample_size=10,
    )

    assert len(recorded) == 1, "the first attempt succeeded, so no fallback should run"
    assert sampled == {"payload": ["{}", '{"a": 1}']}
