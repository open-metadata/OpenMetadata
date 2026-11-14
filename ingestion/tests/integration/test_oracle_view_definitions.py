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
"""View-definition retrieval against a dedicated, disposable Oracle database."""

import os
import secrets
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import MethodType
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import URL

from metadata.ingestion.source.database.oracle.metadata import get_view_definition
from metadata.ingestion.source.database.oracle.utils import (
    denormalize_name,
    normalize_name,
)


@pytest.fixture(scope="module")
def oracle_catalog():
    host_port = os.getenv("ORACLE_VIEW_TEST_HOST_PORT")
    password_file = os.getenv("ORACLE_VIEW_TEST_PASSWORD_FILE")
    if not host_port or not password_file:
        pytest.skip(
            "Set ORACLE_VIEW_TEST_HOST_PORT and ORACLE_VIEW_TEST_PASSWORD_FILE for a disposable Oracle database"
        )
    host, port = host_port.rsplit(":", 1)
    url = URL.create(
        "oracle+oracledb",
        username="system",
        password=Path(password_file).read_text().strip(),
        host=host,
        port=int(port),
        query={"service_name": os.getenv("ORACLE_VIEW_TEST_SERVICE", "FREEPDB1")},
    )
    admin = create_engine(url, hide_parameters=True)
    suffix = uuid4().hex[:8].upper()
    owners = [f"MY_SCHEMA_{suffix}", f"MySchema_{suffix}", f"my_schema_{suffix.lower()}"]
    reader = f"MY_READER_{suffix}"
    reader_password = secrets.token_urlsafe(24)
    system_view = f"MY_VIEW_{suffix}"
    created = []
    system_view_created = False
    try:
        with admin.connect() as connection:
            for name in [*owners, reader]:
                connection.exec_driver_sql(
                    f'CREATE USER "{name}" IDENTIFIED BY "{reader_password}" DEFAULT TABLESPACE USERS QUOTA UNLIMITED ON USERS'
                )
                created.append(name)
            connection.exec_driver_sql(f'GRANT CREATE SESSION TO "{reader}"')
            for index, owner in enumerate(owners):
                connection.exec_driver_sql(f'GRANT CREATE TABLE, CREATE MATERIALIZED VIEW TO "{owner}"')
                connection.exec_driver_sql(f'CREATE TABLE "{owner}".MY_TABLE (id NUMBER)')
                connection.exec_driver_sql(f'INSERT INTO "{owner}".MY_TABLE VALUES (1)')
                connection.commit()
                connection.exec_driver_sql(f'CREATE VIEW "{owner}".MY_VIEW AS SELECT {index + 1} AS id FROM dual')
                connection.exec_driver_sql(
                    f'CREATE MATERIALIZED VIEW "{owner}".MY_MVIEW BUILD IMMEDIATE REFRESH COMPLETE ON DEMAND '
                    f'AS SELECT {index + 11} AS id FROM "{owner}".MY_TABLE'
                )
                connection.exec_driver_sql(f'GRANT SELECT ON "{owner}".MY_VIEW TO "{reader}"')
                connection.exec_driver_sql(f'GRANT SELECT ON "{owner}".MY_MVIEW TO "{reader}"')
            connection.exec_driver_sql(f'CREATE VIEW "{owners[2]}"."my_view" AS SELECT 101 AS id FROM dual')
            connection.exec_driver_sql(f'CREATE VIEW "{owners[2]}"."MyView" AS SELECT 102 AS id FROM dual')
            long_sql = "SELECT 123 AS id " + "/* large definition */ " * 4000 + "FROM dual"
            connection.exec_driver_sql(f'CREATE VIEW "{owners[0]}".MY_LARGE_VIEW AS {long_sql}')
            connection.exec_driver_sql(f"CREATE VIEW SYSTEM.{system_view} AS SELECT 42 AS id FROM dual")
            system_view_created = True
        yield url, owners, reader, reader_password, system_view
    finally:
        with admin.connect() as connection:
            if system_view_created:
                connection.exec_driver_sql(f"DROP VIEW SYSTEM.{system_view}")
            for name in reversed(created):
                connection.exec_driver_sql(f'DROP USER "{name}" CASCADE')
        admin.dispose()


@pytest.mark.parametrize("prefix", ["ALL", "DBA"])
@pytest.mark.parametrize("preserve", [False, True])
def test_real_oracle_bulk_loads_only_requested_owner(oracle_catalog, prefix, preserve):
    url, owners, _, _, _ = oracle_catalog
    engine = create_engine(url, hide_parameters=True)
    engine.dialect.table_prefix = prefix
    engine.dialect.preserve_identifier_case = preserve
    if preserve:
        engine.dialect.denormalize_name = MethodType(denormalize_name, engine.dialect)
        engine.dialect.normalize_name = MethodType(normalize_name, engine.dialect)
    bulk_executions = []

    @event.listens_for(engine, "before_cursor_execute")
    def count_bulk(connection, cursor, statement, parameters, context, executemany):
        if 'AS "view_def"' in statement:
            bulk_executions.append(parameters["owner"])

    cache = {}
    try:
        with engine.connect() as connection:
            selected = owners if preserve else owners[:2]
            for index, owner in enumerate(selected):
                schema = owner if preserve or not owner.isupper() else owner.lower()
                for name, value in (("MY_VIEW", index + 1), ("MY_MVIEW", index + 11)):
                    definition = get_view_definition(
                        engine.dialect, connection, name if preserve else name.lower(), schema, info_cache=cache
                    )
                    assert f"SELECT {value} AS" in definition.upper()
                    assert definition.startswith(f"CREATE OR REPLACE VIEW {name if preserve else name.lower()} AS ")
            assert bulk_executions == selected
    finally:
        cache.clear()
        engine.dispose()


def test_real_oracle_definition_is_not_truncated_to_text_vc(oracle_catalog):
    url, owners, _, _, _ = oracle_catalog
    engine = create_engine(url, hide_parameters=True)
    try:
        with engine.connect() as connection:
            definition = get_view_definition(engine.dialect, connection, "my_large_view", owners[0].lower())
            assert len(definition) > 80000
            assert definition.rstrip().lower().endswith("from dual")
    finally:
        engine.dispose()


def test_real_oracle_maintained_owner_is_not_excluded(oracle_catalog):
    url, _, _, _, view = oracle_catalog
    engine = create_engine(url, hide_parameters=True)
    try:
        with engine.connect() as connection:
            assert (
                connection.execute(
                    text("SELECT oracle_maintained FROM all_users WHERE username = 'SYSTEM'")
                ).scalar_one()
                == "Y"
            )
            definition = get_view_definition(engine.dialect, connection, view.lower(), "system")
            assert "SELECT 42 AS" in definition.upper()
    finally:
        engine.dispose()


def test_real_oracle_all_views_does_not_require_catalog_role(oracle_catalog):
    url, owners, reader, password, _ = oracle_catalog
    engine = create_engine(url.set(username=reader, password=password), hide_parameters=True)
    engine.dialect.table_prefix = "ALL"
    try:
        with engine.connect() as connection:
            roles = connection.execute(text("SELECT role FROM session_roles")).scalars().all()
            assert "SELECT_CATALOG_ROLE" not in roles
            definition = get_view_definition(engine.dialect, connection, "my_view", owners[0].lower())
            assert "SELECT 1 AS" in definition.upper()
    finally:
        engine.dispose()


def test_real_oracle_parallel_schemas_share_engine_but_not_definitions(oracle_catalog):
    url, owners, _, _, _ = oracle_catalog
    engine = create_engine(url, hide_parameters=True)

    executions = []

    @event.listens_for(engine, "before_cursor_execute")
    def count_bulk(connection, cursor, statement, parameters, context, executemany):
        if 'AS "view_def"' in statement:
            executions.append(parameters["owner"])

    def retrieve(owner):
        with engine.connect() as connection:
            inspector = inspect(connection)
            for _ in range(3):
                definition = inspector.get_view_definition("my_view", owner)
                mview_definition = inspector.get_view_definition("my_mview", owner)
            assert len(inspector.info_cache) == 1
            return definition, mview_definition

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            first, second = pool.map(retrieve, [owners[0].lower(), owners[1]])
        assert "SELECT 1 AS" in first[0].upper()
        assert "SELECT 11 AS" in first[1].upper()
        assert "SELECT 2 AS" in second[0].upper()
        assert "SELECT 12 AS" in second[1].upper()
        assert sorted(executions) == sorted(owners[:2])
    finally:
        engine.dispose()


def test_real_inspector_reuses_schema_snapshot_for_views_and_materialized_views(oracle_catalog):
    url, owners, _, _, _ = oracle_catalog
    engine = create_engine(url, hide_parameters=True)
    bulk_count = 0

    @event.listens_for(engine, "before_cursor_execute")
    def count_bulk(connection, cursor, statement, parameters, context, executemany):
        nonlocal bulk_count
        if 'AS "view_def"' in statement:
            bulk_count += 1

    try:
        with engine.connect() as connection:
            inspector = inspect(connection)
            for _ in range(3):
                assert "SELECT 1 AS" in inspector.get_view_definition("my_view", owners[0].lower()).upper()
                assert "SELECT 11 AS" in inspector.get_view_definition("my_mview", owners[0].lower()).upper()
            assert bulk_count == 1
            inspector.info_cache.clear()
    finally:
        engine.dispose()


def test_real_oracle_preserve_case_distinguishes_quoted_view_names(oracle_catalog):
    url, owners, _, _, _ = oracle_catalog
    engine = create_engine(url, hide_parameters=True)
    engine.dialect.preserve_identifier_case = True
    engine.dialect.denormalize_name = MethodType(denormalize_name, engine.dialect)
    engine.dialect.normalize_name = MethodType(normalize_name, engine.dialect)
    try:
        with engine.connect() as connection:
            inspector = inspect(connection)
            for name, value in (("MY_VIEW", 3), ("my_view", 101), ("MyView", 102)):
                definition = inspector.get_view_definition(name, owners[2])
                assert definition.startswith(f"CREATE OR REPLACE VIEW {name} AS ")
                assert f"SELECT {value} AS" in definition.upper()
            inspector.info_cache.clear()
    finally:
        engine.dispose()


def test_real_oracle_snapshot_keeps_all_definitions_without_refetch(oracle_catalog):
    url, owners, _, _, _ = oracle_catalog
    engine = create_engine(url, hide_parameters=True)
    executions = []

    @event.listens_for(engine, "before_cursor_execute")
    def count_bulk(connection, cursor, statement, parameters, context, executemany):
        if 'AS "view_def"' in statement:
            executions.append(parameters["owner"])

    try:
        with engine.connect() as connection:
            inspector = inspect(connection)
            for name, value in (("my_view", 1), ("my_large_view", 123), ("my_mview", 11), ("my_view", 1)):
                definition = inspector.get_view_definition(name, owners[0].lower())
                assert f"SELECT {value} AS" in definition.upper()
                if name == "my_large_view":
                    assert len(definition) > 80000
            assert executions == [owners[0]]
    finally:
        engine.dispose()


def test_real_oracle_schema_switch_replaces_inspector_snapshot(oracle_catalog):
    from metadata.ingestion.source.database.oracle.utils import VIEW_DEFINITION_CACHE_KEY

    url, owners, _, _, _ = oracle_catalog
    engine = create_engine(url, hide_parameters=True)
    executions = []

    @event.listens_for(engine, "before_cursor_execute")
    def count_bulk(connection, cursor, statement, parameters, context, executemany):
        if 'AS "view_def"' in statement:
            executions.append(parameters["owner"])

    try:
        with engine.connect() as connection:
            inspector = inspect(connection)
            for owner, value in ((owners[0], 1), (owners[1], 2), (owners[0], 1)):
                assert f"SELECT {value} AS" in inspector.get_view_definition("my_view", owner).upper()
                scope, definitions = inspector.info_cache[VIEW_DEFINITION_CACHE_KEY]
                assert scope[1] == owner
                assert {schema for _, schema in definitions} == {owner.lower()}
                assert len(inspector.info_cache) == 1
            assert executions == [owners[0], owners[1], owners[0]]
    finally:
        engine.dispose()
