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

"""Regression checks for integration fixture isolation and startup."""

from contextlib import ExitStack
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, inspect, text
from testcontainers.core import waiting_utils

from ..integration.cassandra.conftest import ReadyCassandraContainer  # noqa: TID252
from ..integration.great_expectations import test_great_expectation_integration as gx  # noqa: TID252
from ..integration.orm_profiler import test_orm_profiler_e2e as orm  # noqa: TID252
from ..integration.sql_server.conftest import CustomSqlServerContainer  # noqa: TID252


@pytest.mark.parametrize("uri", [orm.sqlite_shared, gx.SQLLITE_SHARD], ids=["orm", "great-expectations"])
def test_sqlite_fixture_shares_memory_without_creating_files(uri, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with ExitStack() as cleanup:
        writer = create_engine(f"sqlite+pysqlite:///{uri}")
        reader = create_engine(f"sqlite+pysqlite:///{uri}")
        cleanup.callback(writer.dispose)
        cleanup.callback(reader.dispose)
        with writer.begin() as connection:
            connection.execute(text("CREATE TABLE fixture_probe (value INTEGER)"))
            connection.execute(text("INSERT INTO fixture_probe VALUES (42)"))
        with reader.connect() as connection:
            assert connection.execute(text("SELECT value FROM fixture_probe")).scalar_one() == 42
            assert connection.execute(text("PRAGMA database_list")).one()[2] == ""
        assert list(tmp_path.iterdir()) == []


def test_sqlite_fixture_identities_are_separate():
    with ExitStack() as cleanup:
        orm_engine = create_engine(f"sqlite+pysqlite:///{orm.sqlite_shared}")
        gx_engine = create_engine(f"sqlite+pysqlite:///{gx.SQLLITE_SHARD}")
        cleanup.callback(orm_engine.dispose)
        cleanup.callback(gx_engine.dispose)
        orm.Base.metadata.create_all(bind=orm_engine)
        assert "users" in inspect(orm_engine).get_table_names()
        assert inspect(gx_engine).get_table_names() == []


def test_orm_partial_schema_is_repaired_and_cleaned_up():
    engine = create_engine(f"sqlite+pysqlite:///{orm.sqlite_shared}")
    try:
        with orm.create_and_bind_session(engine) as session, ExitStack() as finalizers:
            orm.User.__table__.create(bind=engine)
            request = SimpleNamespace(addfinalizer=finalizers.callback)
            orm.create_data.__wrapped__(engine, session, request)
            assert session.query(orm.User).count() == 4
            assert session.query(orm.NewUser).count() == 2
        assert inspect(engine).get_table_names() == []
    finally:
        engine.dispose()


def test_gx_failed_setup_still_removes_schema(monkeypatch, tmp_path):
    observer = create_engine(f"sqlite+pysqlite:///{gx.SQLLITE_SHARD}")

    def unavailable_api(config):
        raise ConnectionError("Synthetic API outage")

    monkeypatch.setattr(gx, "OpenMetadata", unavailable_api)
    monkeypatch.setattr(gx, "__file__", str(tmp_path / "test_gx.py"))
    try:
        with observer.connect() as connection:
            with pytest.raises(ConnectionError, match="Synthetic API outage"):
                try:
                    gx.TestGreatExpectationIntegration.setUpClass()
                finally:
                    gx.TestGreatExpectationIntegration.doClassCleanups()
            assert inspect(connection).get_table_names() == []
            assert not gx.TestGreatExpectationIntegration.tearDown_exceptions
    finally:
        observer.dispose()


@pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "192.0.2.1"])
def test_sql_server_uses_published_address(host):
    container = SimpleNamespace(
        get_container_host_ip=lambda: host,
        get_exposed_port=lambda port: "21433",
        port=1433,
    )
    expected_host = "127.0.0.1" if host == "localhost" else host
    assert CustomSqlServerContainer.host_port.fget(container) == f"{expected_host}:21433"


@pytest.mark.parametrize(
    ("container_type", "marker", "timeout"),
    [
        (ReadyCassandraContainer, "Startup complete", 120),
    ],
)
@pytest.mark.parametrize("ready_after", [27, None])
def test_database_readiness_ignores_import_time_timeout(container_type, marker, timeout, ready_after, monkeypatch):
    elapsed = 0

    def advance(seconds):
        nonlocal elapsed
        elapsed += seconds

    def logs():
        ready = ready_after is not None and elapsed >= ready_after
        return (marker.encode() if ready else b"Starting", b"")

    monkeypatch.setattr(waiting_utils, "time", SimpleNamespace(time=lambda: elapsed, sleep=advance))
    monkeypatch.setattr(waiting_utils.wait_for_logs, "__defaults__", (10, 1, False, False))
    container = SimpleNamespace(get_logs=logs)
    if ready_after is None:
        with pytest.raises(TimeoutError, match=rf"{timeout}\.000 seconds"):
            container_type._connect(container)
        assert timeout < elapsed <= timeout + 1
    else:
        container_type._connect(container)
        assert elapsed == ready_after
