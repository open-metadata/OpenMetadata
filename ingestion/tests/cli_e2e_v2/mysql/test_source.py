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
from datetime import date, datetime, time
from decimal import Decimal

import docker
import pytest
import yaml
from docker.errors import NotFound
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import OperationalError, ProgrammingError

from ..features.database.pipelines import MetadataPipeline
from ..server import ServerConfig
from . import source as source_module
from .connector import mysql_invocation
from .expected import mysql_expected
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


def test_fresh_source_does_not_inherit_same_count_or_schema_drift(mysql_source, mysql_admin_engine):
    source_a = mysql_source
    source_a.set_value("customers", 1, "credit_score", 999)
    with mysql_admin_engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE `{source_a.schema}`.customers MODIFY first_name VARCHAR(50) NULL"))
        connection.execute(text(f"ALTER TABLE `{source_a.schema}`.customers MODIFY age VARCHAR(20), ADD drift INT"))
        connection.execute(text(f"ALTER TABLE `{source_a.schema}`.all_types DROP COLUMN tiny_int_col"))
        connection.execute(text(f"DELETE FROM `{source_a.schema}`.all_types WHERE id=3"))
    with fresh_mysql_source(mysql_admin_engine) as source_b:
        assert source_a.schema != source_b.schema
        assert _rows(mysql_admin_engine, f"SELECT COUNT(*) FROM `{source_a.schema}`.customers") == [(5,)]
        assert _rows(mysql_admin_engine, f"SELECT COUNT(*) FROM `{source_a.schema}`.all_types") == [(2,)]
        assert "tiny_int_col" not in {
            column["name"] for column in inspect(mysql_admin_engine).get_columns("all_types", source_a.schema)
        }
        assert _rows(mysql_admin_engine, f"SELECT credit_score FROM `{source_a.schema}`.customers WHERE id=1") == [
            (999,)
        ]
        assert _rows(
            mysql_admin_engine,
            f"SELECT id, first_name, credit_score, is_active FROM `{source_b.schema}`.customers ORDER BY id",
        ) == [
            (1, "Alice", 720, 1),
            (2, "Bob", 680, 1),
            (3, "Charlie", 650, 0),
            (4, "Diana", 750, 1),
            (5, "Eve", 600, 1),
        ]
        columns = {
            column["name"]: column for column in inspect(mysql_admin_engine).get_columns("customers", source_b.schema)
        }
        assert set(columns) == {
            "id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "address",
            "city",
            "country",
            "zipcode",
            "date_of_birth",
            "age",
            "credit_score",
            "status",
            "is_active",
            "bio",
            "joined_date",
        }
        assert columns["first_name"]["nullable"] is False
        assert columns["credit_score"]["nullable"] is True
        assert str(columns["age"]["type"]) == "INTEGER"
        assert str(columns["is_active"]["type"]) == "TINYINT"
        assert _rows(mysql_admin_engine, f"SELECT COUNT(*) FROM `{source_b.schema}`.all_types") == [(3,)]
        assert _rows(mysql_admin_engine, f"SELECT id, tiny_int_col FROM `{source_b.schema}`.all_types ORDER BY id") == [
            (1, -12),
            (2, None),
            (3, None),
        ]
        with pytest.raises(KeyError):
            source_a.drop_table(f"{source_b.schema}.all_types")
        with pytest.raises(KeyError):
            source_a.set_value(f"{source_b.schema}.customers", 1, "credit_score", 1)
        with pytest.raises(ValueError, match="Expected one"):
            source_a.set_value("customers", 999, "credit_score", 1)
        source_a.drop_table("all_types")
        assert _rows(mysql_admin_engine, f"SELECT COUNT(*) FROM `{source_b.schema}`.all_types") == [(3,)]
        assert not inspect(mysql_admin_engine).has_table("all_types", schema=source_a.schema)
    _assert_removed(mysql_admin_engine, source_b.schema)


def test_native_seeds_foreign_key_view_and_procedure_bodies(mysql_source, mysql_admin_engine):
    table = mysql_source.baseline.metadata.tables[f"{mysql_source.schema}.all_types"]
    with mysql_admin_engine.connect() as connection:
        rows = connection.execute(select(table).order_by(table.c.id)).mappings().all()
    assert dict(rows[0]) == {
        "id": 1,
        "tiny_int_col": -12,
        "small_int_col": 1234,
        "medium_int_col": 70000,
        "int_col": 123456,
        "big_int_col": 9000000000,
        "float_col": 1.5,
        "double_col": 2.25,
        "decimal_col": Decimal("1234.56"),
        "char_col": "fixed",
        "varchar_col": "variable",
        "tinytext_col": "tiny text",
        "text_col": "text value",
        "mediumtext_col": "medium text",
        "longtext_col": "long text",
        "binary_col": b"0123456789abcdef",
        "varbinary_col": b"variable bytes",
        "tinyblob_col": b"tiny blob",
        "blob_col": b"blob value",
        "mediumblob_col": b"medium blob",
        "longblob_col": b"long blob",
        "date_col": date(2026, 1, 2),
        "time_col": time(12, 34, 56),
        "datetime_col": datetime(2026, 1, 2, 12, 34, 56),
        "timestamp_col": datetime(2026, 1, 2, 12, 34, 56),
        "year_col": 2026,
        "bit_col": 5,
        "json_col": {"kind": "fixture", "count": 2},
        "enum_col": "beta",
        "set_col": {"x", "z"},
    }
    assert [row["id"] for row in rows] == [1, 2, 3]
    assert all(value is None for row in rows[1:] for name, value in row.items() if name != "id")
    fk = inspect(mysql_admin_engine).get_foreign_keys("transactions", mysql_source.schema)[0]
    assert (fk["constrained_columns"], fk["referred_schema"], fk["referred_table"], fk["referred_columns"]) == (
        ["customer_id"],
        mysql_source.schema,
        "customers",
        ["id"],
    )
    assert _rows(
        mysql_admin_engine,
        f"SELECT customer_id, txn_count, total_amount FROM `{mysql_source.schema}`.customer_txn_summary ORDER BY customer_id",
    ) == [
        (1, 2, Decimal("175.49")),
        (2, 1, Decimal("250.00")),
        (3, 1, Decimal("19.99")),
        (4, 1, Decimal("125.50")),
        (5, 0, Decimal("0.00")),
    ]
    assert _rows(mysql_admin_engine, f"CALL `{mysql_source.schema}`.sp_active_customer_count()") == [(3,)]
    with mysql_admin_engine.begin() as connection:
        connection.execute(text(f"CALL `{mysql_source.schema}`.sp_update_customer_status(1, 'inactive')"))
    assert _rows(mysql_admin_engine, f"SELECT status FROM `{mysql_source.schema}`.customers WHERE id=1") == [
        ("inactive",)
    ]


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
        grants = "\n".join(row[0] for row in _rows(mysql_ingestion_engine, "SHOW GRANTS"))
        assert "PROCESS" in grants and "SHOW_ROUTINE" in grants
        routines = _rows(
            mysql_ingestion_engine,
            "SELECT ROUTINE_NAME, ROUTINE_DEFINITION FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=:schema",
            schema=source_b.schema,
        )
        assert {name for name, body in routines if body} == {"sp_active_customer_count", "sp_update_customer_status"}
    _assert_removed(mysql_admin_engine, source_b.schema)


def test_invocations_bind_owned_sources_and_exact_filters(mysql_source, mysql_admin_engine, monkeypatch):
    monkeypatch.setenv("E2E_MYSQL_DATABASE", "unrelated_schema")
    monkeypatch.setenv("OM_SERVER_URL", "http://127.0.0.1:1/api")
    monkeypatch.setenv("OM_JWT_TOKEN", "test-token")
    server = ServerConfig("http://127.0.0.1:1/api", "test-token", "env")
    options = MetadataPipeline(includeStoredProcedures=True, includeDDL=True)

    def invocation(sources, filters=None):
        return mysql_invocation(
            service_name="my_service", sources=sources, options=options, filters=filters or {}, server=server
        )

    a = invocation((mysql_source,))
    with fresh_mysql_source(mysql_admin_engine) as source_b:
        b = invocation((source_b,))
        filters = {
            "schemaFilterPattern": {"includes": [mysql_source.schema, source_b.schema], "excludes": [source_b.schema]},
            "tableFilterPattern": {"includes": ["customer.*"], "excludes": ["customer_txn.*"]},
        }
        multi = yaml.safe_load(yaml.safe_dump(invocation((mysql_source, source_b), filters).config))
        assert "databaseSchema" not in multi["source"]["serviceConnection"]["config"]
        assert {name: multi["source"]["sourceConfig"]["config"][name] for name in filters} == filters
        assert b.config["source"]["serviceConnection"]["config"]["databaseSchema"] == source_b.schema
        assert mysql_expected("my_service", schema=source_b.schema).databases[0].schemas[0].name == source_b.schema
    assert a.config["source"]["serviceConnection"]["config"] == {
        "type": "Mysql",
        "username": "${E2E_MYSQL_USER}",
        "authType": {"password": "${E2E_MYSQL_PASSWORD}"},
        "hostPort": "${E2E_MYSQL_HOST_PORT}",
        "databaseSchema": mysql_source.schema,
    }
    assert options.schemaFilterPattern is None
    assert os.environ["E2E_MYSQL_DATABASE"] == "unrelated_schema"
    with pytest.raises(ValueError, match="nonempty tuple"):
        invocation(())
    with pytest.raises(ValueError, match="already been closed"):
        invocation((source_b,))
    monkeypatch.setenv("E2E_MYSQL_HOST_PORT", "127.0.0.1:1")
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
