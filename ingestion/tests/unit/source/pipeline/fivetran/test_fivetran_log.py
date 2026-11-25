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
"""Unit tests for querying the Fivetran Platform Connector log table.

The queries run against a real SQLite database holding a real ``log`` table, so
the SQL the connector builds is executed rather than asserted on.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from pydantic import BaseModel
from sqlalchemy import create_engine, event
from sqlalchemy.dialects.sqlite.pysqlite import SQLiteDialect_pysqlite

from metadata.generated.schema.entity.data.pipeline import StatusType
from metadata.ingestion.source.pipeline.fivetran.fivetran_log import (
    DEFAULT_LOG_SCHEMA,
    build_task_statuses,
    query_sync_logs,
    resolve_log_schema,
)
from metadata.utils.helpers import datetime_to_ts

FIVETRAN_LOG_MODULE = "metadata.ingestion.source.pipeline.fivetran.fivetran_log"
LOG_SCHEMA = "acme_ops_audit_logs"
CONNECTOR_ID = "untruth_abrogation"

NOW = datetime.now(timezone.utc)
SYNC_START = NOW - timedelta(days=1)
RECENT = SYNC_START.strftime("%Y-%m-%d %H:%M:%S")
EXPIRED = (NOW - timedelta(days=120)).strftime("%Y-%m-%d %H:%M:%S")

LOG_ROWS = [
    ("sync-1", CONNECTOR_ID, "sync_start", None, RECENT),
    ("sync-1", CONNECTOR_ID, "extract_summary", '{"status":"SUCCESS"}', RECENT),
    ("sync-1", CONNECTOR_ID, "sync_end", '{"status":"SUCCESSFUL"}', RECENT),
    # Rows that must not come back: another connection, an event we do not parse,
    # a sync older than the log retention window, and a row with no sync_id.
    ("sync-2", "valley_dazzled", "sync_start", None, RECENT),
    ("sync-1", CONNECTOR_ID, "records_modified", None, RECENT),
    ("sync-3", CONNECTOR_ID, "sync_start", None, EXPIRED),
    (None, CONNECTOR_ID, "sync_start", None, RECENT),
]


class _TableList(BaseModel):
    """Stand-in for Snowflake's ``SnowflakeTableList``.

    OpenMetadata replaces ``get_table_names`` on the Snowflake dialect with a
    version returning this pydantic model (issue #32253). Iterating a model
    yields ``(field_name, value)`` pairs, so SQLAlchemy's reflection blows up
    with ``unhashable type: 'list'`` on the list of tables.
    """

    tables: list[str]


def _make_engine(tmp_path, schema: str):
    """SQLite engine with ``schema`` attached, so ``schema.log`` resolves."""
    schema_file = tmp_path / f"{schema}.db"
    engine = create_engine(f"sqlite:///{tmp_path / 'destination.db'}")

    @event.listens_for(engine, "connect")
    def _attach_schema(dbapi_connection, _record):
        dbapi_connection.execute(f"ATTACH DATABASE '{schema_file}' AS {schema}")

    with engine.connect() as conn:
        conn.exec_driver_sql(
            f"CREATE TABLE IF NOT EXISTS {schema}.log "
            "(sync_id TEXT, connection_id TEXT, message_event TEXT, message_data TEXT, time_stamp TIMESTAMP)"
        )
        for row in LOG_ROWS:
            conn.exec_driver_sql(f"INSERT INTO {schema}.log VALUES (?, ?, ?, ?, ?)", row)
        conn.commit()
    return engine


@pytest.fixture
def log_engine(tmp_path):
    engine = _make_engine(tmp_path, LOG_SCHEMA)
    with patch(f"{FIVETRAN_LOG_MODULE}.get_db_connection", return_value=engine):
        yield engine
    engine.dispose()


@pytest.fixture
def default_schema_engine(tmp_path):
    engine = _make_engine(tmp_path, DEFAULT_LOG_SCHEMA)
    with patch(f"{FIVETRAN_LOG_MODULE}.get_db_connection", return_value=engine):
        yield engine
    engine.dispose()


class TestQuerySyncLogs:
    def test_reads_syncs_from_the_account_log_schema(self, log_engine):
        syncs = query_sync_logs(MagicMock(), "FIVETRAN_DB", CONNECTOR_ID, LOG_SCHEMA)

        assert list(syncs) == ["sync-1"]
        assert syncs["sync-1"]["extract_data"] == {"status": "SUCCESS"}
        assert syncs["sync-1"]["sync_end_data"] == {"status": "SUCCESSFUL"}

    def test_builds_task_statuses_from_the_rows_it_read(self, log_engine):
        """Timestamps have to come back as datetimes for the statuses to be built."""
        syncs = query_sync_logs(MagicMock(), "FIVETRAN_DB", CONNECTOR_ID, LOG_SCHEMA)

        statuses = build_task_statuses(syncs["sync-1"])

        assert [status.executionStatus for status in statuses] == [StatusType.Successful] * 3
        assert statuses[0].startTime.root == datetime_to_ts(SYNC_START.replace(microsecond=0, tzinfo=None))

    def test_survives_a_dialect_returning_a_model_of_table_names(self, default_schema_engine):
        """The Snowflake destination case from issue #32253.

        Guards against reflection coming back: the patched dialect below is what
        OpenMetadata does to Snowflake, and reflecting under it raises.
        """
        with patch.object(
            SQLiteDialect_pysqlite,
            "get_table_names",
            lambda *_args, **_kwargs: _TableList(tables=["log"]),
        ):
            syncs = query_sync_logs(MagicMock(), "FIVETRAN_DB", CONNECTOR_ID, DEFAULT_LOG_SCHEMA)

        assert list(syncs) == ["sync-1"]

    def test_missing_schema_reports_the_schema_it_looked_for(self, log_engine, caplog):
        syncs = query_sync_logs(MagicMock(), "FIVETRAN_DB", CONNECTOR_ID, "not_a_schema")

        assert syncs is None
        assert "Could not query not_a_schema.log" in caplog.text


class TestResolveLogSchema:
    def test_uses_the_platform_connection_schema(self):
        connectors = [
            {"id": "aiding_pointless", "service": "postgres_rds", "schema": "postgres_rds"},
            {"id": CONNECTOR_ID, "service": "fivetran_log", "schema": LOG_SCHEMA},
        ]

        assert resolve_log_schema(connectors) == LOG_SCHEMA

    def test_falls_back_when_no_platform_connection_is_present(self):
        connectors = [{"id": "aiding_pointless", "service": "postgres_rds", "schema": "postgres_rds"}]

        assert resolve_log_schema(connectors) == DEFAULT_LOG_SCHEMA

    def test_falls_back_when_the_platform_connection_has_no_schema(self):
        connectors = [{"id": CONNECTOR_ID, "service": "fivetran_log"}]

        assert resolve_log_schema(connectors) == DEFAULT_LOG_SCHEMA
