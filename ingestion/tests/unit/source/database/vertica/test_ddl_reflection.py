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
"""DDL reflection must not bypass batched Vertica comments."""

import subprocess
import sys
from textwrap import dedent
from types import MethodType, SimpleNamespace

import pytest
from sqlalchemy import MetaData, Table, create_engine, event, inspect, text
from sqlalchemy_vertica.dialect_vertica_python import VerticaDialect

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.vertica.metadata import VerticaInspector, VerticaSource
from metadata.utils.sqlalchemy_utils import get_all_table_ddls


@pytest.fixture
def catalog():
    """Provide a synthetic Vertica catalog on SQLite and record executed SQL."""
    engine = create_engine("sqlite://")
    statements = []
    event.listen(engine, "before_cursor_execute", lambda *args: statements.append(args[2]))
    with engine.connect() as connection:
        connection.execute(text("ATTACH DATABASE ':memory:' AS my_schema"))
        connection.execute(text("ATTACH DATABASE ':memory:' AS v_catalog"))
        connection.execute(
            text(
                "CREATE TABLE v_catalog.comments "
                "(object_type TEXT, object_schema TEXT, object_name TEXT, child_object TEXT, comment TEXT)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE v_catalog.columns "
                "(table_schema TEXT, table_name TEXT, column_name TEXT, data_type TEXT, "
                "column_default TEXT, is_nullable BOOLEAN)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE v_catalog.view_columns "
                "(table_schema TEXT, table_name TEXT, column_name TEXT, data_type TEXT)"
            )
        )
        for name in ("my_table_a", "my_table_b", "my_table_c"):
            connection.execute(text(f"CREATE TABLE my_schema.{name} (my_column INTEGER)"))
            connection.execute(
                text("INSERT INTO v_catalog.columns VALUES ('my_schema', :name, 'my_column', 'integer', NULL, true)"),
                {"name": name},
            )
            connection.execute(
                text(
                    "INSERT INTO v_catalog.comments VALUES ('COLUMN', 'my_schema', :name, 'my_column', 'Column comment')"
                ),
                {"name": name},
            )
            connection.execute(
                text("INSERT INTO v_catalog.comments VALUES ('TABLE', 'my_schema', :name, NULL, 'Table comment')"),
                {"name": name},
            )
        connection.commit()
        statements.clear()
        yield connection, statements
    engine.dispose()


@pytest.fixture
def reflection_catalog(catalog):
    """Execute Vertica column/comment readers with SQLite table discovery."""
    connection, _ = catalog
    dialect = connection.dialect
    for name in (
        "get_columns",
        "_get_column_info",
        "get_table_comment",
        "get_all_table_comments",
        "get_pk_constraint",
    ):
        setattr(dialect, name, MethodType(getattr(VerticaDialect, name), dialect))
    dialect.ischema_names = VerticaDialect.ischema_names
    dialect._column_comment_support = True
    dialect.reflection_options = VerticaDialect.reflection_options
    dialect.inspector = VerticaDialect.inspector
    return catalog


def test_concrete_dialect_selects_comment_free_ddl_inspector(catalog, monkeypatch):
    connection, statements = catalog
    for ddl in (
        "CREATE TABLE v_catalog.tables (table_id INTEGER, table_schema TEXT, table_name TEXT, is_temp_table BOOLEAN)",
        "CREATE TABLE v_catalog.views (table_id INTEGER, table_schema TEXT, table_name TEXT)",
        "CREATE TABLE v_catalog.constraint_columns "
        "(table_id INTEGER, table_schema TEXT, table_name TEXT, constraint_name TEXT, "
        "column_name TEXT, constraint_type TEXT)",
    ):
        connection.execute(text(ddl))
    connection.execute(
        text("INSERT INTO v_catalog.tables VALUES (:id, 'my_schema', :name, false)"),
        [{"id": index, "name": name} for index, name in enumerate(("my_table_a", "my_table_b", "my_table_c"), 1)],
    )
    connection.commit()

    engine = create_engine("vertica+vertica_python://")
    try:
        # Retain SQLite's DBAPI connection; exercise the complete registered Vertica dialect.
        monkeypatch.setattr(connection.engine, "dialect", engine.dialect)
        monkeypatch.setattr(connection, "dialect", engine.dialect)
        statements.clear()
        inspector = inspect(connection)

        assert isinstance(inspector, VerticaInspector)
        ddl = inspector.get_table_ddl(connection, "my_table_a", "my_schema")

        assert ddl.strip() == "CREATE TABLE my_schema.my_table_a (\n\tmy_column INTEGER\n)"
        assert inspector.all_table_ddls == {
            ("my_schema", name): f"\nCREATE TABLE my_schema.{name} (\n\tmy_column INTEGER\n)\n\n"
            for name in ("my_table_a", "my_table_b", "my_table_c")
        }
        assert not any("v_catalog.comments" in statement or "pg_catalog" in statement for statement in statements)
        assert next(iter(inspector.get_columns("my_table_a", "my_schema")))["comment"] == "Column comment"
        assert inspector.get_table_comment("my_table_a", "my_schema") == {"text": "Table comment"}
    finally:
        engine.dispose()


@pytest.mark.parametrize("include_ddl", [False, True])
def test_ddl_does_not_reload_comments_outside_active_batch(reflection_catalog, monkeypatch, include_ddl):
    connection, statements = reflection_catalog
    inspector = inspect(connection)
    source = object.__new__(VerticaSource)
    source._comment_batches = {}
    source.context = SimpleNamespace(get_current_thread_id=lambda: 1)
    source.source_config = SimpleNamespace(includeDDL=include_ddl)
    monkeypatch.setattr(CommonDbSourceService, "connection", property(lambda _: connection))
    monkeypatch.setattr(CommonDbSourceService, "inspector", property(lambda _: inspector))

    source._load_comment_batch("my_schema", ["my_table_a", "my_table_b"])
    columns = source._get_columns_internal("my_schema", "my_table_a", "my_db", inspector, TableType.Regular)
    description = source.get_table_description("my_schema", "my_table_a", inspector)
    ddl = source.get_schema_definition(TableType.Regular, "my_table_a", "my_schema", inspector)

    assert columns[0]["comment"] == "Column comment"
    assert description == "Table comment"
    if include_ddl:
        assert ddl == "CREATE TABLE my_schema.my_table_a (\n\tmy_column INTEGER\n)"
        assert ("my_schema", "my_table_c") in inspector.all_table_ddls
    else:
        assert ddl is None
        assert not hasattr(inspector, "all_table_ddls")
    assert len([statement for statement in statements if "v_catalog.comments" in statement]) == 1
    assert not any("LEFT JOIN v_catalog.comments" in statement for statement in statements)
    assert not hasattr(inspector.dialect, "all_table_comments")

    assert next(iter(inspector.get_columns("my_table_a", "my_schema", vertica_include_comments=False)))["comment"] == ""
    assert inspector.get_table_comment("my_table_a", "my_schema", vertica_include_comments=False) == {"text": None}
    for options in ({}, {"vertica_include_comments": True}):
        assert next(iter(inspector.get_columns("my_table_a", "my_schema", **options)))["comment"] == "Column comment"
        assert inspector.get_table_comment("my_table_a", "my_schema", **options) == {"text": "Table comment"}


def test_foreign_key_reflection_preserves_comment_option(reflection_catalog, monkeypatch):
    connection, statements = reflection_catalog
    original_foreign_keys = connection.dialect.get_foreign_keys

    def foreign_keys(connection, table_name, schema=None, **kw):
        if table_name == "my_table_b":
            return [
                {
                    "name": "my_fk",
                    "constrained_columns": ["my_column"],
                    "referred_schema": "my_schema",
                    "referred_table": "my_table_a",
                    "referred_columns": ["my_column"],
                    "options": {},
                }
            ]
        return original_foreign_keys(connection, table_name, schema=schema, **kw)

    # The pinned Vertica driver has no FK reader; exercise SQLAlchemy's dependent-table path.
    monkeypatch.setattr(connection.dialect, "get_foreign_keys", foreign_keys)
    metadata = MetaData()
    table = Table("my_table_b", metadata, schema="my_schema", autoload_with=connection, vertica_include_comments=False)

    assert set(metadata.tables) == {"my_schema.my_table_a", "my_schema.my_table_b"}
    assert next(iter(table.foreign_keys)).column is metadata.tables["my_schema.my_table_a"].c.my_column
    assert not any("v_catalog.comments" in statement for statement in statements)


def test_shared_ddl_helper_preserves_other_dialect_and_ignores_internal_options():
    engine = create_engine("sqlite://")
    with engine.connect() as connection:
        connection.execute(text("CREATE TABLE my_parent (id INTEGER PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE my_child (parent_id INTEGER REFERENCES my_parent(id))"))
        inspector = inspect(connection)

        get_all_table_ddls(inspector, connection, None, "main", info_cache={}, unrelated_option=True)

        assert inspector.all_table_ddls == {
            ("main", "my_parent"): "\nCREATE TABLE main.my_parent (\n\tid INTEGER, \n\tPRIMARY KEY (id)\n)\n\n",
            ("main", "my_child"): (
                "\nCREATE TABLE main.my_child (\n\tparent_id INTEGER, \n"
                "\tFOREIGN KEY(parent_id) REFERENCES main.my_parent (id)\n)\n\n"
            ),
        }
    engine.dispose()


@pytest.mark.parametrize("postgresql_first", [False, True])
def test_vertica_option_registration_does_not_change_postgresql_validation(postgresql_first):
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            dedent(
                """
                import sys
                import warnings
                from sqlalchemy import MetaData, Table
                from sqlalchemy.exc import ArgumentError, SAWarning

                warnings.simplefilter('error', SAWarning)

                def assert_postgresql_rejects_option():
                    try:
                        Table('my_table', MetaData(), postgresql_include_comments=False)
                    except ArgumentError:
                        return
                    raise AssertionError('Vertica option leaked into PostgreSQL')

                if sys.argv[1] == 'True':
                    assert_postgresql_rejects_option()
                from metadata.ingestion.source.database.vertica import metadata
                assert_postgresql_rejects_option()
                table = Table('my_table', MetaData(), vertica_include_comments=False)
                assert table.dialect_options['vertica']['include_comments'] is False
                """
            ),
            str(postgresql_first),
        ],
        capture_output=True,
        text=True,
        check=False,
        timeout=60,
    )
    assert result.returncode == 0, result.stdout + result.stderr
