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
"""Live MySQL isolation, grants, owned cleanup and source-bound workflow gates."""

import os
from contextlib import ExitStack, closing

import docker
import pytest
from docker.errors import NotFound
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError, ProgrammingError

from ..features.database.pipelines import MetadataPipeline
from ..server import ServerConfig
from . import source as source_module
from .connector import mysql_invocation
from .source import fresh_mysql_instance, fresh_mysql_source


def _rows(engine, sql, **parameters):
    with engine.connect() as connection:
        return connection.execute(text(sql), parameters).all()


def _assert_removed(engine, schema):
    assert (
        _rows(engine, "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=:name", name=schema) == []
    )
    assert (
        _rows(
            engine,
            "SELECT PRIVILEGE_TYPE FROM information_schema.SCHEMA_PRIVILEGES WHERE TABLE_SCHEMA=:name",
            name=schema,
        )
        == []
    )


def test_sources_isolate_mutations_and_cleanup(mysql_admin_engine, mysql_ingestion_engine):
    with ExitStack() as cleanup:
        with fresh_mysql_source(mysql_admin_engine) as source_a:
            source_a.set_value("customers", 1, "credit_score", 999)
            source_a.drop_table("all_types")
            assert _rows(mysql_admin_engine, f"SELECT credit_score FROM `{source_a.schema}`.customers WHERE id=1") == [
                (999,)
            ]
            assert not inspect(mysql_admin_engine).has_table("all_types", schema=source_a.schema)

            source_b = cleanup.enter_context(fresh_mysql_source(mysql_admin_engine))
            assert source_a.schema != source_b.schema
            with pytest.raises(KeyError):
                source_a.drop_table(f"{source_b.schema}.all_types")
            with pytest.raises(KeyError):
                source_a.set_value(f"{source_b.schema}.customers", 1, "credit_score", 1)
            with pytest.raises(ValueError, match="Expected one"):
                source_a.set_value("customers", 999, "credit_score", 1)
            assert _rows(
                mysql_ingestion_engine, f"SELECT credit_score FROM `{source_b.schema}`.customers WHERE id=1"
            ) == [(720,)]
            assert _rows(mysql_ingestion_engine, f"SELECT COUNT(*) FROM `{source_b.schema}`.all_types") == [(3,)]

        _assert_removed(mysql_admin_engine, source_a.schema)
        assert _rows(mysql_ingestion_engine, f"SELECT credit_score FROM `{source_b.schema}`.customers WHERE id=1") == [
            (720,)
        ]
        assert _rows(mysql_ingestion_engine, f"SELECT COUNT(*) FROM `{source_b.schema}`.all_types") == [(3,)]
    _assert_removed(mysql_admin_engine, source_b.schema)


def test_ingestion_account_reads_both_owned_schemas_but_cannot_write(
    mysql_source, mysql_admin_engine, mysql_ingestion_engine
):
    with fresh_mysql_source(mysql_admin_engine) as source_b:
        visible = {row[0] for row in _rows(mysql_ingestion_engine, "SHOW DATABASES")}
        assert {mysql_source.schema, source_b.schema} <= visible
        for source in (mysql_source, source_b):
            assert _rows(mysql_ingestion_engine, f"SELECT COUNT(*) FROM `{source.schema}`.customers") == [(5,)]
            with pytest.raises((OperationalError, ProgrammingError)):
                _rows(mysql_ingestion_engine, f"UPDATE `{source.schema}`.customers SET credit_score=1 WHERE id=1")
        with pytest.raises((OperationalError, ProgrammingError)):
            _rows(mysql_ingestion_engine, "SELECT User FROM mysql.user")
        routines = _rows(
            mysql_ingestion_engine,
            "SELECT ROUTINE_DEFINITION FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=:schema",
            schema=source_b.schema,
        )
        assert routines
        assert all(body for (body,) in routines)
    _assert_removed(mysql_admin_engine, source_b.schema)


def test_invocations_reject_unowned_connection_environments_and_closed_sources(
    mysql_source, mysql_admin_engine, monkeypatch
):
    monkeypatch.setenv("E2E_MYSQL_DATABASE", "unrelated_schema")
    monkeypatch.setenv("OM_SERVER_URL", "http://127.0.0.1:1/api")
    monkeypatch.setenv("OM_JWT_TOKEN", "test-token")
    server = ServerConfig("http://127.0.0.1:1/api", "test-token", "env")

    def invocation(sources):
        return mysql_invocation(
            service_name="my_service", sources=sources, options=MetadataPipeline(), filters={}, server=server
        )

    assert (
        invocation((mysql_source,)).config["source"]["serviceConnection"]["config"]["databaseSchema"]
        == mysql_source.schema
    )
    with fresh_mysql_source(mysql_admin_engine) as source_b:
        invocation((source_b,))
    with pytest.raises(ValueError, match="nonempty tuple"):
        invocation(())
    with pytest.raises(ValueError, match="already been closed"):
        invocation((source_b,))
    for key, value in (("E2E_MYSQL_HOST_PORT", "127.0.0.1:1"), ("E2E_MYSQL_USER", "unrelated_user")):
        with monkeypatch.context() as mismatch:
            mismatch.setenv(key, value)
            with pytest.raises(ValueError, match="fixture instance"):
                invocation((mysql_source,))


def test_seed_failure_removes_schema_and_grants(mysql_admin_engine, monkeypatch):
    allocated = []
    seed = source_module._seed_source

    def fail_after_seed(source):
        allocated.append(source.schema)
        seed(source)
        raise RuntimeError("injected seed failure")

    monkeypatch.setattr(source_module, "_seed_source", fail_after_seed)
    with pytest.raises(RuntimeError, match="injected seed failure"), fresh_mysql_source(mysql_admin_engine):
        pytest.fail("Setup should not yield")
    assert len(allocated) == 1
    _assert_removed(mysql_admin_engine, allocated[0])


@pytest.mark.parametrize("phase", ["setup", "body"])
def test_cleanup_failure_preserves_primary_error_and_still_drops_schema(mysql_admin_engine, monkeypatch, phase):
    allocated = []
    original_revoke = source_module._revoke_schema_grant

    def fail_revoke(engine, quoted, user):
        allocated.append((quoted, user))
        raise RuntimeError("injected grant cleanup failure")

    def fail_seed(source):
        raise AssertionError("primary setup failure")

    monkeypatch.setattr(source_module, "_revoke_schema_grant", fail_revoke)
    if phase == "setup":
        monkeypatch.setattr(source_module, "_seed_source", fail_seed)
    try:
        with (
            pytest.raises(RuntimeError, match="injected grant cleanup failure") as error,
            fresh_mysql_source(mysql_admin_engine),
        ):
            raise AssertionError("primary body failure")
        assert isinstance(error.value.__context__, AssertionError)
        assert str(error.value.__context__) == f"primary {phase} failure"
        schema = allocated[0][0].strip("`")
        assert (
            _rows(
                mysql_admin_engine,
                "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=:name",
                name=schema,
            )
            == []
        )
    finally:
        for quoted, user in allocated:
            original_revoke(mysql_admin_engine, quoted, user)
    _assert_removed(mysql_admin_engine, schema)


def test_container_success_cleanup_restores_environment(ci_output, mysql_container, mysql_source, record_property):
    keys = ("E2E_MYSQL_USER", "E2E_MYSQL_PASSWORD", "E2E_MYSQL_HOST_PORT", "E2E_MYSQL_DATABASE")
    previous = {key: os.environ.get(key) for key in keys}
    record_property("session_container", mysql_container.get_wrapped_container().id)
    with closing(docker.from_env()) as client:
        with ExitStack() as cleanup:
            with ci_output():
                instance = cleanup.enter_context(fresh_mysql_instance())
            container_id = instance.container.get_wrapped_container().id
            with fresh_mysql_source(instance.admin_engine) as source:
                assert _rows(instance.ingestion_engine, f"SELECT COUNT(*) FROM `{source.schema}`.customers") == [(5,)]
                with pytest.raises(ValueError, match="same fixture instance"):
                    mysql_invocation(
                        service_name="my_service",
                        sources=(mysql_source, source),
                        options=MetadataPipeline(),
                        filters={},
                        server=ServerConfig("http://127.0.0.1:1/api", "test-token", "env"),
                    )
            _assert_removed(instance.admin_engine, source.schema)
        with pytest.raises(NotFound):
            client.containers.get(container_id)
    assert {key: os.environ.get(key) for key in keys} == previous
    record_property("removed_success_container", container_id)


def test_container_readiness_failure_is_logged_and_removed(ci_output, monkeypatch, caplog, record_property):
    created = []
    original_container = source_module.MySqlContainer
    original_wait = source_module._wait_for_mysql
    previous = {key: os.environ.get(key) for key in ("E2E_MYSQL_USER", "E2E_MYSQL_PASSWORD", "E2E_MYSQL_HOST_PORT")}

    def capture_container(*args, **kwargs):
        container = original_container(*args, **kwargs)
        created.append(container)
        return container

    def fail_readiness(engine):
        original_wait(engine)
        raise RuntimeError("injected readiness failure")

    monkeypatch.setattr(source_module, "MySqlContainer", capture_container)
    monkeypatch.setattr(source_module, "_wait_for_mysql", fail_readiness)
    with pytest.raises(RuntimeError, match="injected readiness failure"), ci_output(), fresh_mysql_instance():
        pytest.fail("Setup should not yield")
    container_id = created[0].get_wrapped_container().id
    with closing(docker.from_env()) as client, pytest.raises(NotFound):
        client.containers.get(container_id)
    assert "MySQL startup failed" in caplog.text
    assert "ready for connections" in caplog.text
    assert created[0].password not in caplog.text
    assert {key: os.environ.get(key) for key in previous} == previous
    record_property("removed_failed_container", container_id)


@pytest.mark.parametrize("engine_fixture", ["mysql_admin_engine", "mysql_ingestion_engine"])
def test_query_errors_do_not_include_bound_credentials(request, engine_fixture):
    engine = request.getfixturevalue(engine_fixture)
    password = "synthetic-bound-credential-canary"
    with pytest.raises(OperationalError) as error:
        source_module._execute(
            engine,
            "SELECT :password FROM information_schema.e2e_missing_table",
            password=password,
        )
    assert error.value.orig.args[0] == 1109
    assert "e2e_missing_table" in str(error.value)
    assert password not in str(error.value)
