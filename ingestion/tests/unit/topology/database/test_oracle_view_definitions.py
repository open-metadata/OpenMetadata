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
"""Oracle view-definition scope and query-count regressions."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from types import MethodType, SimpleNamespace
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.dialects.oracle.base import OracleDialect
from sqlalchemy.exc import DatabaseError

from metadata.ingestion.source.database.oracle.utils import (
    VIEW_DEFINITION_CACHE_KEY,
    _read_bulk_view_definition,
    denormalize_name,
    get_view_definition,
    normalize_name,
)


@pytest.fixture
def catalog(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'catalog.db'}")
    executions = []

    @event.listens_for(engine, "before_cursor_execute", retval=True)
    def translate_ddl(connection, cursor, statement, parameters, context, executemany):
        executions.append((statement, parameters))
        return statement.replace("DBMS_METADATA.GET_DDL", "get_ddl"), parameters

    @event.listens_for(engine, "connect")
    def register_ddl(connection, record):
        connection.create_function("get_ddl", 3, lambda *args: "CREATE VIEW my_view AS SELECT 9")

    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE dual (dummy TEXT)")
        connection.exec_driver_sql("INSERT INTO dual VALUES (NULL)")
        for prefix in ("ALL", "DBA"):
            connection.exec_driver_sql(f"CREATE TABLE {prefix}_USERS (username TEXT, oracle_maintained TEXT)")
            connection.exec_driver_sql(f"CREATE TABLE {prefix}_VIEWS (owner TEXT, view_name TEXT, text TEXT)")
            connection.exec_driver_sql(f"CREATE TABLE {prefix}_MVIEWS (owner TEXT, mview_name TEXT, query TEXT)")
            for owner, flag, value in (("MY_SCHEMA", "N", 1), ("MY_OTHER_SCHEMA", "Y", 2), ("MySchema", "N", 3)):
                connection.execute(
                    text(f"INSERT INTO {prefix}_USERS VALUES (:owner, :flag)"), {"owner": owner, "flag": flag}
                )
                connection.execute(
                    text(f"INSERT INTO {prefix}_VIEWS VALUES (:owner, 'MY_VIEW', :sql)"),
                    {"owner": owner, "sql": f"SELECT {value}"},
                )
                connection.execute(
                    text(f"INSERT INTO {prefix}_MVIEWS VALUES (:owner, 'MY_MVIEW', :sql)"),
                    {"owner": owner, "sql": f"SELECT {value + 10}"},
                )
    executions.clear()
    yield engine, executions
    engine.dispose()


def dialect(prefix="DBA", preserve=False):
    result = OracleDialect()
    result.table_prefix = prefix
    result.preserve_identifier_case = preserve
    result.default_schema_name = "MY_SCHEMA"
    if preserve:
        result.normalize_name = MethodType(normalize_name, result)
        result.denormalize_name = MethodType(denormalize_name, result)
    return result


@pytest.mark.parametrize("prefix", ["ALL", "DBA"])
@pytest.mark.parametrize("preserve", [False, True])
def test_each_owner_gets_its_own_definition_without_maintenance_filter(catalog, prefix, preserve):
    engine, executions = catalog
    oracle = dialect(prefix, preserve)
    cache = {}
    try:
        with engine.connect() as connection:
            for owner, value in (("MY_SCHEMA", 1), ("MY_OTHER_SCHEMA", 2), ("MySchema", 3)):
                schema = owner if preserve else owner.lower() if owner.isupper() else owner
                view = "MY_VIEW" if preserve else "my_view"
                mview = "MY_MVIEW" if preserve else "my_mview"
                assert get_view_definition(oracle, connection, view, schema, info_cache=cache).endswith(
                    f"AS SELECT {value}"
                )
                assert get_view_definition(oracle, connection, mview, schema, info_cache=cache).endswith(
                    f"AS SELECT {value + 10}"
                )
        assert len(executions) == 3
    finally:
        cache.clear()


def test_empty_schema_is_loaded_once(catalog):
    engine, executions = catalog
    cache = {}
    try:
        with engine.connect() as connection:
            oracle = dialect()
            assert get_view_definition(oracle, connection, "missing_a", "my_empty", info_cache=cache) == ""
            assert get_view_definition(oracle, connection, "missing_b", "my_empty", info_cache=cache) == ""
            assert get_view_definition(oracle, connection, "missing_a", "my_empty", info_cache=cache) == ""
            assert get_view_definition(oracle, connection, "missing_b", "my_empty", info_cache=cache) == ""
        assert len(executions) == 1
    finally:
        cache.clear()


def test_default_owner_and_bound_owner_with_quote(catalog):
    engine, _ = catalog
    owner = "My'Schema"
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO DBA_VIEWS VALUES (:owner, 'MY_VIEW', 'SELECT 42')"), {"owner": owner})
    cache = {}
    try:
        with engine.connect() as connection:
            oracle = dialect()
            assert get_view_definition(oracle, connection, "my_view", info_cache=cache).endswith("AS SELECT 1")
            assert get_view_definition(oracle, connection, "my_view", owner, info_cache=cache).endswith("AS SELECT 42")
    finally:
        cache.clear()


def test_large_schema_is_loaded_once_without_per_view_reflection_entries(catalog):
    engine, executions = catalog
    count = 5000
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO DBA_VIEWS VALUES ('MY_SCHEMA', :name, :sql)"),
            [{"name": f"V_{index}", "sql": f"SELECT {index}"} for index in range(count)],
        )
    executions.clear()
    cache = {}
    try:
        with engine.connect() as connection:
            oracle = dialect()
            for index in sorted(range(count), key=lambda index: f"V_{index}"):
                assert get_view_definition(oracle, connection, f"v_{index}", "my_schema", info_cache=cache).endswith(
                    f"AS SELECT {index}"
                )
        assert len(executions) == 1
        assert len(cache) == 1
    finally:
        cache.clear()


def test_concurrent_schema_loads_do_not_share_partially_loaded_results(catalog):
    engine, _ = catalog
    first_started, release_first = Event(), Event()
    oracle = dialect()

    @event.listens_for(engine, "before_cursor_execute")
    def block_first(connection, cursor, statement, parameters, context, executemany):
        if 'AS "view_def"' in statement and "MY_OTHER_SCHEMA" not in parameters:
            first_started.set()
            assert release_first.wait(timeout=5)

    def read(schema):
        cache = {}
        try:
            with engine.connect() as connection:
                return get_view_definition(oracle, connection, "my_view", schema, info_cache=cache)
        finally:
            cache.clear()

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(read, "my_schema")
        try:
            assert first_started.wait(timeout=5)
            second = pool.submit(read, "my_other_schema")
            assert second.result(timeout=5).endswith("AS SELECT 2")
        finally:
            release_first.set()
        assert first.result(timeout=5).endswith("AS SELECT 1")


def test_many_small_schemas_do_not_accumulate_snapshots(catalog):
    engine, executions = catalog
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO DBA_VIEWS VALUES (:owner, 'MY_VIEW', :sql)"),
            [{"owner": f"MY_SCHEMA_{index}", "sql": f"SELECT {index}"} for index in range(200)],
        )
    executions.clear()
    cache = {}
    try:
        with engine.connect() as connection:
            oracle = dialect()
            for index in range(200):
                assert get_view_definition(
                    oracle, connection, "my_view", f"my_schema_{index}", info_cache=cache
                ).endswith(f"AS SELECT {index}")
                assert len(cache) == 1
                scope, definitions = cache[VIEW_DEFINITION_CACHE_KEY]
                assert scope[1] == f"MY_SCHEMA_{index}"
                assert list(definitions) == [("my_view", f"my_schema_{index}")]
        assert len(executions) == 200
    finally:
        cache.clear()


@pytest.mark.parametrize("prefix", ["ALL", "DBA"])
def test_fallback_stays_in_owner_and_isolates_denied_ddl(catalog, prefix):
    engine, executions = catalog

    @event.listens_for(engine, "before_cursor_execute")
    def deny_view(connection, cursor, statement, parameters, context, executemany):
        if 'AS "view_def"' in statement:
            raise DatabaseError(statement, parameters, Exception("ORA-01406"))
        if statement.lstrip().startswith("SELECT text FROM") or statement.lstrip().startswith("SELECT get_ddl"):
            raise DatabaseError(statement, parameters, Exception("ORA-31603"))

    cache = {}
    try:
        with engine.connect() as connection:
            oracle = dialect(prefix)
            assert get_view_definition(oracle, connection, "my_mview", "my_schema", info_cache=cache).endswith(
                "AS SELECT 11"
            )
            assert get_view_definition(oracle, connection, "my_view", "my_schema", info_cache=cache) == ""
        assert sum('AS "view_def"' in sql for sql, _ in executions) == 1
        assert all("MY_OTHER_SCHEMA" not in parameters for _, parameters in executions)
    finally:
        cache.clear()


@pytest.mark.parametrize("prefix", ["ALL", "DBA"])
@pytest.mark.parametrize("preserve", [False, True])
@pytest.mark.parametrize("retry", ["denied", "empty", "recovered"])
def test_partial_bulk_failure_preserves_definitions_when_retry_has_no_sql(prefix, preserve, retry):
    owner = "MySchema" if preserve else "MY_SCHEMA"
    name = "MyView" if preserve else "MY_VIEW"
    schema = "MySchema" if preserve else "my_schema"
    view_name = "MyView" if preserve else "my_view"
    connection = MagicMock()
    executions = []

    def partial_rows():
        yield SimpleNamespace(view_name=view_name, schema=schema, view_def="SELECT 1", view_ddl=None)
        raise DatabaseError("bulk fetch", None, Exception("ORA-01406"))

    bulk = MagicMock()
    bulk.__iter__.side_effect = partial_rows
    names = MagicMock()
    names.__iter__.side_effect = lambda: iter([(owner, name, "VIEW"), (owner, "UNREADABLE_VIEW", "VIEW")])

    def execute(query, parameters):
        statement = str(query)
        executions.append(statement)
        assert parameters["owner"] == owner
        if 'AS "view_def"' in statement:
            return bulk
        if 'AS "object_type"' in statement:
            return names
        if parameters["name"] == "UNREADABLE_VIEW" or retry == "denied":
            raise DatabaseError(statement, parameters, Exception("ORA-31603"))
        value = "SELECT 2" if retry == "recovered" else None
        return SimpleNamespace(scalar=lambda: value, close=lambda: None)

    connection.execute.side_effect = execute
    oracle = dialect(prefix, preserve)
    cache = {}
    expected = (
        f"CREATE OR REPLACE VIEW {name} AS SELECT 2"
        if retry == "recovered"
        else (f"CREATE OR REPLACE VIEW {view_name} AS SELECT 1")
    )
    try:
        assert get_view_definition(oracle, connection, view_name, schema, info_cache=cache) == expected
        executed = len(executions)
        assert get_view_definition(oracle, connection, view_name, schema, info_cache=cache) == expected
        unreadable = "UNREADABLE_VIEW" if preserve else "unreadable_view"
        assert get_view_definition(oracle, connection, unreadable, schema, info_cache=cache) == ""
        assert get_view_definition(oracle, connection, unreadable, schema, info_cache=cache) == ""
        assert len(executions) == executed
    finally:
        cache.clear()


def test_switching_engines_does_not_reuse_schema_snapshot(catalog, tmp_path):
    engine, _ = catalog
    other = create_engine(f"sqlite:///{tmp_path / 'other.db'}")
    cache = {}
    try:
        with engine.connect() as connection:
            assert get_view_definition(dialect(), connection, "my_view", "my_schema", info_cache=cache).endswith(
                "AS SELECT 1"
            )
        with other.connect() as connection, pytest.raises(DatabaseError):
            get_view_definition(dialect(), connection, "my_view", "my_schema", info_cache=cache)
    finally:
        cache.clear()
        other.dispose()


@pytest.mark.parametrize("uppercase", [False, True])
@pytest.mark.parametrize("raw_sql", ["SELECT 1", None])
def test_bulk_rows_support_driver_label_case_and_lob_ddl(uppercase, raw_sql):
    row = {
        "view_name": "my_view",
        "schema": "my_schema",
        "view_def": raw_sql,
        "view_ddl": SimpleNamespace(read=lambda: "CREATE VIEW my_view AS SELECT 9"),
    }
    if uppercase:
        row = {key.upper(): value for key, value in row.items()}
    key, definition = _read_bulk_view_definition(SimpleNamespace(**row))
    expected = "CREATE OR REPLACE VIEW my_view AS SELECT 1" if raw_sql else "CREATE VIEW my_view AS SELECT 9"
    assert key == ("my_view", "my_schema")
    assert definition == expected


def test_source_engine_release_drops_inspectors_and_connections(catalog):
    from sqlalchemy import inspect

    from metadata.ingestion.source.database.oracle.metadata import OracleSource

    engine, _ = catalog
    connection = engine.connect()
    inspector = inspect(connection)
    get_view_definition(dialect(), connection, "my_view", "my_schema", info_cache=inspector.info_cache)
    source = OracleSource.__new__(OracleSource)
    source.engine = engine
    source._connection = None
    source._connection_map = {1: connection}
    source._inspector_map = {1: inspector}
    source.session = None
    source._release_engine()
    assert connection.closed
    assert source._connection_map == {}
    assert source._inspector_map == {}


def test_future_definitions_remain_cached_in_arbitrary_processing_order(catalog):
    engine, executions = catalog
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO DBA_VIEWS VALUES ('MY_SCHEMA', :name, :sql)"),
            [{"name": name, "sql": f"SELECT {index}"} for index, name in enumerate("ABCDEF")],
        )
    cache = {}
    executions.clear()
    with engine.connect() as connection:
        oracle = dialect()
        for name, value in (("a", 0), ("d", 3), ("b", 1), ("e", 4), ("f", 5), ("a", 0)):
            assert get_view_definition(oracle, connection, name, "my_schema", info_cache=cache).endswith(
                f"AS SELECT {value}"
            )
    assert len(executions) == 1
    assert len(cache[VIEW_DEFINITION_CACHE_KEY][1]) == 8


def test_large_definition_is_cached_in_full(catalog):
    engine, executions = catalog
    sql = "SELECT 42 /* " + "x" * (9 * 1024 * 1024) + " */"
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO DBA_VIEWS VALUES ('MY_SCHEMA', 'V_LARGE', :sql)"), {"sql": sql})
    cache = {}
    executions.clear()
    with engine.connect() as connection:
        for _ in range(2):
            assert get_view_definition(dialect(), connection, "v_large", "my_schema", info_cache=cache) == (
                "CREATE OR REPLACE VIEW v_large AS " + sql
            )
    assert len(executions) == 1


def test_failed_schema_load_is_not_published_and_can_be_retried(catalog):
    engine, _ = catalog
    failures = 1

    @event.listens_for(engine, "before_cursor_execute")
    def fail_once(connection, cursor, statement, parameters, context, executemany):
        nonlocal failures
        if 'AS "view_def"' in statement and failures:
            failures -= 1
            raise ValueError("row conversion failed")

    cache = {}
    with engine.connect() as connection:
        with pytest.raises(ValueError, match="row conversion failed"):
            get_view_definition(dialect(), connection, "my_view", "my_schema", info_cache=cache)
        assert VIEW_DEFINITION_CACHE_KEY not in cache
        assert get_view_definition(dialect(), connection, "my_view", "my_schema", info_cache=cache).endswith(
            "AS SELECT 1"
        )


def test_unicode_definition_is_retained_in_full(catalog):
    engine, executions = catalog
    sql = "SELECT 1 /* " + "\U0001f600" * 1000 + " */"
    with engine.begin() as connection:
        connection.execute(text("UPDATE DBA_VIEWS SET text=:sql WHERE owner='MY_SCHEMA'"), {"sql": sql})
    cache = {}
    executions.clear()
    with engine.connect() as connection:
        for _ in range(2):
            assert get_view_definition(dialect(), connection, "my_view", "my_schema", info_cache=cache) == (
                "CREATE OR REPLACE VIEW my_view AS " + sql
            )
    assert len(executions) == 1


def test_malformed_driver_row_fails_explicitly():
    with pytest.raises(ValueError, match="no definition labels"):
        _read_bulk_view_definition(SimpleNamespace(unexpected="SELECT 1"))


def test_schema_switch_replaces_snapshot_and_revisiting_reloads(catalog):
    engine, executions = catalog
    cache = {}

    @event.listens_for(engine, "before_cursor_execute")
    def previous_snapshot_is_released(connection, cursor, statement, parameters, context, executemany):
        if 'AS "view_def"' in statement:
            assert VIEW_DEFINITION_CACHE_KEY not in cache

    with engine.connect() as connection:
        oracle = dialect()
        for schema, value in (("my_schema", 1), ("my_other_schema", 2), ("my_schema", 1)):
            assert get_view_definition(oracle, connection, "my_view", schema, info_cache=cache).endswith(
                f"AS SELECT {value}"
            )
            scope, definitions = cache[VIEW_DEFINITION_CACHE_KEY]
            assert scope[1] == schema.upper()
            assert len(definitions) == 2
            assert {owner for _, owner in definitions} == {schema}
            assert len(cache) == 1
    assert len(executions) == 3


def test_catalog_prefix_change_reloads_the_same_owner(catalog):
    engine, executions = catalog
    with engine.begin() as connection:
        connection.execute(text("UPDATE ALL_VIEWS SET text='SELECT 99' WHERE owner='MY_SCHEMA'"))
    cache = {}
    executions.clear()
    with engine.connect() as connection:
        oracle = dialect("DBA")
        assert get_view_definition(oracle, connection, "my_view", "my_schema", info_cache=cache).endswith("AS SELECT 1")
        oracle.table_prefix = "ALL"
        assert get_view_definition(oracle, connection, "my_view", "my_schema", info_cache=cache).endswith(
            "AS SELECT 99"
        )
    assert len(executions) == 2
