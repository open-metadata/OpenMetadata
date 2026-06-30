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
"""Unit tests for the shared database check helpers."""

import socket
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.database import (
    DatabaseStep,
    list_schemas,
    list_tables,
    list_views,
    ping,
    run_sql,
)
from metadata.core.connections.test_connection.network import NetworkUnreachableError


def _closed_port() -> int:
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


@pytest.fixture()
def engine():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    with eng.connect() as conn:
        for i in range(3):
            conn.exec_driver_sql(f"CREATE TABLE t{i} (id INTEGER)")
        for i in range(2):
            conn.exec_driver_sql(f"CREATE VIEW v{i} AS SELECT 1")
    return eng


def test_database_step_values_match_schema():
    assert DatabaseStep.CheckAccess.value == "CheckAccess"
    assert DatabaseStep.GetTables.value == "GetTables"
    assert DatabaseStep.GetStreams.value == "GetStreams"


def test_ping_succeeds_on_a_live_engine(engine):
    # the in-memory sqlite URL carries no host:port, so the preflight is skipped.
    evidence = ping(engine)
    assert evidence.summary == "connection established"
    assert evidence.command == "SELECT 1"


def test_ping_fails_as_a_network_error_when_the_host_is_unreachable():
    port = _closed_port()
    client = MagicMock()
    client.url.host = "127.0.0.1"
    client.url.port = port
    with pytest.raises(CheckError) as exc:
        ping(client)
    assert exc.value.evidence.command == f"TCP connect 127.0.0.1:{port}"
    assert isinstance(exc.value.cause, NetworkUnreachableError)


def test_run_sql_reports_the_same_statement_it_ran(engine):
    evidence = run_sql(engine, "SELECT 1 UNION SELECT 2", lambda rows: f"{len(rows)} rows")
    assert evidence.command == "SELECT 1 UNION SELECT 2"
    assert evidence.summary == "2 rows"


def test_list_tables_names_the_explicit_schema(engine):
    assert list_tables(engine, "main").summary == "3 tables in schema 'main'"


def test_list_views_names_the_explicit_schema(engine):
    assert list_views(engine, "main").summary == "2 views in schema 'main'"


def test_list_tables_auto_selects_and_flags_when_schema_unset(engine):
    # sqlite exposes a single 'main' schema; with no databaseSchema it is picked.
    assert list_tables(engine, None).summary == (
        "3 tables in schema 'main', auto-selected because no databaseSchema was configured"
    )


def test_auto_select_skips_connector_supplied_system_schemas():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    with eng.connect() as conn:
        conn.exec_driver_sql("ATTACH DATABASE ':memory:' AS userschema")
        conn.exec_driver_sql("CREATE TABLE userschema.t1 (id INTEGER)")
    # 'main' is flagged as a system schema, so the probe falls through to it.
    summary = list_tables(eng, None, frozenset({"main"})).summary
    assert summary == ("1 table in schema 'userschema', auto-selected because no databaseSchema was configured")


def test_list_schemas_summarizes_count(engine):
    assert list_schemas(engine).summary == "1 schema enumerated"


def test_run_sql_failure_carries_the_attempted_command(engine):
    with pytest.raises(CheckError) as exc:
        run_sql(engine, "SELECT * FROM does_not_exist", lambda rows: "n")
    assert exc.value.evidence.command == "SELECT * FROM does_not_exist"
    assert isinstance(exc.value.cause, Exception)
