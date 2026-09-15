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
"""Regression tests for the corrections applied to the Vertica dialect.

sqlalchemy-vertica 0.0.5 predates SQLAlchemy 2.0 and breaks in three ways, each
covered below.

Initialization: the dialect passes ``SELECT version()`` and
``SELECT current_schema()`` to ``Connection.scalar()`` as bare strings.
SQLAlchemy 2.x rejects a plain string at the API boundary, before the statement
reaches any server, so the first ``engine.connect()`` raises and Test Connection
never gets past CheckAccess. Both run inside ``DefaultDialect.initialize()``,
version first, so correcting only the version moves the failure to the schema
lookup rather than clearing it.

Reflection: only the singular ``get_*`` methods are overridden, so the batched
``get_multi_*`` API that ``MetaData.reflect()`` calls in SQLAlchemy 2.x is
inherited from ``PGDialect`` and reads ``pg_catalog``, which Vertica does not
have. Reflection fails with MissingSchema, ``get_all_table_ddls`` swallows it at
debug level, and tables silently carry no schema definition while views, fetched
one at a time through the singular path, are unaffected.

Column comments: the column query joins ``v_catalog.comments`` on
``child_object``, which Vertica exposes only from version 10. On older servers
the join cannot be expressed, so the statement fails and takes the whole column
read with it instead of merely losing the comments.
"""

from unittest.mock import Mock, patch

import pytest
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine.reflection import ObjectKind, ObjectScope
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.pool import StaticPool
from sqlalchemy_vertica.dialect_vertica_python import VerticaDialect

# Importing the connector applies the dialect corrections under test, and this
# is the dialect the vertica_python scheme actually builds.
from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.vertica.metadata import (
    get_columns,
    supports_column_comments,
)

BATCHED_REFLECTION_METHODS = (
    "get_multi_columns",
    "get_multi_pk_constraint",
    "get_multi_foreign_keys",
    "get_multi_indexes",
    "get_multi_table_comment",
    "get_multi_unique_constraints",
    "get_multi_check_constraints",
)


@pytest.fixture(name="initializing_engine")
def initializing_engine_fixture():
    """An engine that answers the two statements issued during initialization.

    SQLite stands in for the server deliberately. Both statements are rejected
    before they reach any database when passed as raw strings, so the defect
    reproduces on any engine. Registering the functions lets them execute, which
    covers the version parsing too rather than only the call.
    """

    def _build(reported_version: str = "Vertica Analytic Database v9.2.0-7"):
        engine = create_engine("sqlite://")

        @event.listens_for(engine, "connect")
        def _register(dbapi_connection, _):  # pyright: ignore[reportUnusedFunction]
            dbapi_connection.create_function("version", 0, lambda: reported_version)
            dbapi_connection.create_function("current_schema", 0, lambda: "omd_test")

        return engine

    return _build


@pytest.fixture(name="catalog_engine")
def catalog_engine_fixture():
    """Builds an engine whose ``v_catalog.comments`` can be shaped per test.

    SQLite attaches a second database under an arbitrary name, so a real
    ``v_catalog.comments`` relation exists and the probe runs its real statement
    against a real connection rather than a stubbed one.
    """

    def _build(with_child_object: bool):
        engine = create_engine("sqlite://", poolclass=StaticPool)
        columns = "child_object TEXT, comment TEXT" if with_child_object else "comment TEXT"
        with engine.connect() as connection:
            connection.execute(text("ATTACH DATABASE ':memory:' AS v_catalog"))
            connection.execute(text(f"CREATE TABLE v_catalog.comments ({columns})"))
            connection.commit()
        return engine

    return _build


class TestVerticaDialectInitialization:
    """The two statements DefaultDialect.initialize() issues on first connect."""

    @pytest.mark.parametrize(
        ("reported_version", "expected"),
        [
            ("Vertica Analytic Database v9.2.0-7", (9, 2, 0)),
            ("Vertica Analytic Database v25.4.0-0", (25, 4, 0)),
            # A patch level of two or more digits has to survive intact. It
            # was previously truncated to its final digit, so a 12.0.15 server
            # reported itself as 12.0.5.
            ("Vertica Analytic Database v12.0.15-0", (12, 0, 15)),
        ],
    )
    def test_server_version_is_executable_and_parsed(self, initializing_engine, reported_version, expected):
        engine = initializing_engine(reported_version)

        with engine.connect() as connection:
            assert VerticaDialect()._get_server_version_info(connection) == expected

    def test_default_schema_is_executable(self, initializing_engine):
        engine = initializing_engine()

        with engine.connect() as connection:
            assert VerticaDialect()._get_default_schema_name(connection) == "omd_test"


class TestVerticaBatchedReflection:
    """MetaData.reflect() must not land on Postgres implementations."""

    @pytest.mark.parametrize("batched_method", BATCHED_REFLECTION_METHODS)
    def test_does_not_fall_through_to_postgres(self, batched_method: str):
        resolved = getattr(VerticaDialect, batched_method)

        assert not resolved.__module__.startswith("sqlalchemy.dialects.postgresql"), (
            f"{batched_method} resolves to {resolved.__module__}, which reads pg_catalog"
        )


class TestVerticaColumnCommentSupport:
    """Servers below Vertica 10 keep their columns, losing only the comments."""

    def test_detected_when_child_object_exists(self, catalog_engine):
        engine = catalog_engine(with_child_object=True)

        with engine.connect() as connection:
            assert supports_column_comments(VerticaDialect(), connection) is True

    def test_not_detected_when_child_object_missing(self):
        """Vertica reports the absent column as a ProgrammingError, so that is
        what decides the fallback. SQLite raises OperationalError for the same
        situation, which is why this case is driven by the real error rather
        than by attaching a table without the column.
        """
        connection = Mock()
        connection.execute.side_effect = ProgrammingError("SELECT child_object", {}, Exception("does not exist"))

        assert supports_column_comments(VerticaDialect(), connection) is False

    def test_probed_once_per_dialect(self):
        """The answer cannot change while connected, and probing per table would
        log a failing statement for every table on an older server.
        """
        connection = Mock()
        connection.execute.side_effect = ProgrammingError("SELECT child_object", {}, Exception("does not exist"))
        dialect = VerticaDialect()

        supports_column_comments(dialect, connection)
        supports_column_comments(dialect, connection)

        assert connection.execute.call_count == 1

    def test_transient_failure_degrades_without_being_remembered(self):
        """A timeout or dropped connection says nothing about what the server
        supports. The columns still have to arrive, so this call falls back, but
        the answer is left open instead of stripping comments for the session.
        """
        connection = Mock()
        connection.execute.side_effect = OperationalError("SELECT child_object", {}, Exception("connection reset"))
        dialect = VerticaDialect()

        assert supports_column_comments(dialect, connection) is False
        assert getattr(dialect, "_column_comment_support", None) is None

        # The next call asks again rather than trusting the earlier failure.
        connection.execute.side_effect = None
        assert supports_column_comments(dialect, connection) is True


def _column_row(name: str, data_type: str, comment: str | None = None):
    """One row shaped like the column query returns, read by attribute."""
    row = Mock()
    row.column_name = name
    row.data_type = data_type
    row.column_default = None
    row.is_nullable = True
    row.comment = comment
    return row


class TestVerticaGetColumnsFallback:
    """The branch that keeps older servers working, exercised end to end."""

    @staticmethod
    def _connection():
        """Answers the three statements get_columns issues, with the probe
        rejected the way a pre-10 server rejects it.

        Only the driver is stood in for. The dialect code under test runs for
        real, including the branch that picks the template.
        """
        connection = Mock()

        def _execute(statement, *_args, **_kw):
            rendered = str(statement)
            if "child_object" in rendered:
                raise ProgrammingError("SELECT child_object", {}, Exception("does not exist"))
            if "primary_keys" in rendered:
                return [("customer_id",)]
            return [_column_row("customer_id", "int"), _column_row("region", "varchar(40)")]

        connection.execute.side_effect = _execute
        return connection

    def test_columns_survive_when_the_probe_reports_no_support(self):
        """A server without child_object must still yield its columns. Without
        this the whole read fails and the table arrives with no schema
        definition, which is the defect being fixed.
        """
        columns = list(get_columns(VerticaDialect(), self._connection(), "customers", schema="omd_test"))

        assert [column["name"] for column in columns] == ["customer_id", "region"]

    def test_the_fallback_template_is_the_one_executed(self):
        """Guards the branch itself. Selecting the commented template regardless
        would leave older servers broken while every other test stays green.
        """
        connection = self._connection()

        list(get_columns(VerticaDialect(), connection, "customers", schema="omd_test"))

        executed = [str(call.args[0]) for call in connection.execute.call_args_list]
        columns_statement = next(statement for statement in executed if "v_catalog.columns" in statement)
        assert "child_object" not in columns_statement


class TestVerticaBatchedReflectionDelegates:
    """Resolving away from Postgres is not enough. The batched API has to route
    back onto the Vertica implementation rather than issue its own catalog query.
    """

    def test_get_multi_columns_calls_the_dialect_get_columns(self):
        dialect = VerticaDialect()
        connection = Mock()
        reflected = [{"name": "customer_id"}]

        with (
            patch.object(VerticaDialect, "get_columns", return_value=reflected) as singular,
            patch.object(VerticaDialect, "get_table_names", return_value=["customers"]),
            patch.object(VerticaDialect, "get_temp_table_names", return_value=[]),
        ):
            result = dict(
                dialect.get_multi_columns(
                    connection,
                    schema="omd_test",
                    filter_names=["customers"],
                    kind=(ObjectKind.TABLE,),
                    scope=ObjectScope.DEFAULT,
                )
            )

        assert singular.called
        assert list(result.values()) == [reflected]


class TestVerticaSchemaDefinitionPath:
    """#23533 is only fixed if the source actually reaches table DDL.

    get_schema_definition takes the table branch on two conditions: the
    inspector carries get_table_ddl, and includeDDL is on. Those helpers are
    registered on Inspector globally, so this drives the real path end to end
    rather than trusting the registration alone.
    """

    @staticmethod
    def _source(include_ddl: bool):
        source = Mock()
        source.source_config.includeDDL = include_ddl
        source.connection = Mock()
        return source

    def test_a_vertica_inspector_carries_the_ddl_helpers(self):
        inspector = inspect(create_engine("sqlite://"))

        assert hasattr(inspector, "get_table_ddl")
        assert hasattr(inspector, "get_all_table_ddls")

    def test_table_schema_definition_comes_back_when_include_ddl_is_on(self):
        inspector = inspect(create_engine("sqlite://"))
        ddl = "CREATE TABLE omd_test.customers (customer_id INTEGER)"

        # Seed the reflection cache the wrapper reads, so the real
        # get_table_ddl chain runs without needing a live server.
        inspector.all_table_ddls = {("omd_test", "customers"): ddl}
        inspector.current_db = "omd_test"

        definition = CommonDbSourceService.get_schema_definition(
            self._source(include_ddl=True), TableType.Regular, "customers", "omd_test", inspector
        )

        assert definition == ddl

    def test_no_table_schema_definition_when_include_ddl_is_off(self):
        """The flag still governs the table branch, so a service that did not
        ask for DDL does not silently get it.
        """
        inspector = inspect(create_engine("sqlite://"))
        inspector.all_table_ddls = {("omd_test", "customers"): "CREATE TABLE ..."}
        inspector.current_db = "omd_test"

        definition = CommonDbSourceService.get_schema_definition(
            self._source(include_ddl=False), TableType.Regular, "customers", "omd_test", inspector
        )

        assert definition is None
