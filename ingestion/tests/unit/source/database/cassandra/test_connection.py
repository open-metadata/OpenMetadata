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
"""Unit tests for the Cassandra BaseConnection wiring (non-Engine: driver Session)."""

from collections.abc import Iterator
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from cassandra import Unauthorized

from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.generated.schema.entity.services.connections.database.cassandraConnection import (
    CassandraConnection as CassandraConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.cassandra.connection import (
    CassandraChecks,
    CassandraConnection,
)

CONNECTION_MODULE = "metadata.ingestion.source.database.cassandra.connection"


def _config(**kwargs) -> CassandraConnectionConfig:
    return CassandraConnectionConfig(hostPort="localhost:9042", **kwargs)


def test_cassandra_connection_is_base_connection():
    assert issubclass(CassandraConnection, BaseConnection)


def test_get_client_connects_a_cluster_session():
    with patch(f"{CONNECTION_MODULE}.Cluster") as mock_cluster:
        session = CassandraConnection(_config()).client
    mock_cluster.assert_called_once()
    mock_cluster.return_value.connect.assert_called_once_with()
    assert session is mock_cluster.return_value.connect.return_value


def test_close_shuts_down_the_cluster():
    with patch(f"{CONNECTION_MODULE}.Cluster") as mock_cluster:
        connection = CassandraConnection(_config())
        _ = connection.client
        connection.close()
    mock_cluster.return_value.shutdown.assert_called_once_with()


def _rows(*names: str) -> list[MagicMock]:
    rows = []
    for name in names:
        row = MagicMock()
        row.keyspace_name = name
        rows.append(row)
    return rows


def _session(keyspaces: list[str], readable: list[str]) -> MagicMock:
    """A session whose keyspace reads succeed only for `readable`"""
    session = MagicMock()

    def execute(statement, parameters=None):
        if "system_schema.keyspaces" in statement:
            return _rows(*keyspaces)
        if parameters is not None:
            keyspace = parameters[0]
            if keyspace not in readable:
                raise Unauthorized(f"not authorized on {keyspace}")
            result = MagicMock()
            result.current_rows = [MagicMock()]
            result.has_more_pages = False
            return result
        version = MagicMock()
        version.release_version = "4.1.3"
        result = MagicMock()
        result.current_rows = [version]
        return result

    session.execute.side_effect = execute
    return session


@contextmanager
def _checks(config: CassandraConnectionConfig, session: MagicMock) -> Iterator[CassandraChecks]:
    """The provider, with the driver patched for as long as its checks run.

    The client is borrowed, so it is built on first read - inside the step, not
    at construction.
    """
    with patch(f"{CONNECTION_MODULE}.Cluster") as mock_cluster:
        mock_cluster.return_value.connect.return_value = session
        yield CassandraConnection(config).checks()


def _probed_keyspaces(session: MagicMock) -> list[str]:
    return [call.args[1][0] for call in session.execute.call_args_list if len(call.args) > 1]


def test_cassandra_checks_cover_the_definition_steps():
    with _checks(_config(), _session(["sales"], ["sales"])) as checks:
        steps = collect_checks(checks)
    assert set(steps) == {
        DatabaseStep.CheckAccess,
        DatabaseStep.GetSchemas,
        DatabaseStep.GetTables,
        DatabaseStep.GetViews,
    }


def test_get_tables_skips_the_keyspaces_filtered_out():
    """The probe must not read a keyspace the ingestion is configured to skip"""
    config = _config(schemaFilterPattern={"excludes": ["system.*"]})
    session = _session(["system", "system_auth", "sales"], readable=["sales"])

    with _checks(config, session) as checks:
        evidence = checks.get_tables()

    assert _probed_keyspaces(session) == ["sales"]
    assert "sales" in evidence.summary


def test_get_tables_defers_the_system_keyspaces():
    """Ingestion reads them, so they are probed last rather than dropped"""
    session = _session(["system", "sales"], readable=["system", "sales"])

    with _checks(_config(), session) as checks:
        checks.get_tables()

    assert _probed_keyspaces(session) == ["sales"]


def test_get_tables_passes_when_one_keyspace_can_be_read():
    session = _session(["system", "system_auth", "sales"], readable=["system_auth"])

    with _checks(_config(), session) as checks:
        evidence = checks.get_tables()

    assert _probed_keyspaces(session) == ["sales", "system", "system_auth"]
    assert "system_auth" in evidence.summary


def test_get_tables_fails_when_no_keyspace_can_be_read():
    session = _session(["system", "sales"], readable=[])

    with _checks(_config(), session) as checks, pytest.raises(CheckError):
        checks.get_tables()


def test_get_tables_without_a_keyspace_in_scope_is_a_caveat_not_a_failure():
    """A None keyspace used to be bound into the query; nothing in scope is not an error"""
    config = _config(schemaFilterPattern={"excludes": [".*"]})
    session = _session(["system", "sales"], readable=["sales"])

    with _checks(config, session) as checks:
        evidence = checks.get_tables()

    assert _probed_keyspaces(session) == []
    assert evidence.caveat is not None


def test_get_schemas_reports_the_keyspaces_in_scope():
    config = _config(schemaFilterPattern={"includes": ["sales"]})
    session = _session(["system", "sales"], readable=["sales"])

    with _checks(config, session) as checks:
        evidence = checks.get_schemas()

    assert "1 keyspace" in evidence.summary
    assert evidence.caveat is None


def test_get_tables_reports_a_floor_when_the_result_is_paged():
    """Only the first page is read, so the count must not read as a total"""
    session = _session(["sales"], readable=["sales"])
    original = session.execute.side_effect

    def paged(statement, parameters=None):
        result = original(statement, parameters)
        if parameters is not None:
            result.has_more_pages = True
        return result

    session.execute.side_effect = paged

    with _checks(_config(), session) as checks:
        evidence = checks.get_tables()

    assert "more exist" in evidence.summary
