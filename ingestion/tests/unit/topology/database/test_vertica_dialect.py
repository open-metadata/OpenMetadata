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

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.pool import StaticPool
from sqlalchemy_vertica.dialect_vertica_python import VerticaDialect

# Importing the connector applies the dialect corrections under test, and this
# is the dialect the vertica_python scheme actually builds.
from metadata.ingestion.source.database.vertica.metadata import supports_column_comments

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
            # A patch level of two or more digits must survive intact. Written as
            # (\d)+ the quantifier sits outside the group and keeps only the last
            # digit, reporting 12.0.5 for a 12.0.15 server.
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

    def test_not_detected_when_child_object_missing(self, catalog_engine):
        engine = catalog_engine(with_child_object=False)

        with engine.connect() as connection:
            assert supports_column_comments(VerticaDialect(), connection) is False

    def test_probed_once_per_dialect(self, catalog_engine):
        """The answer cannot change while connected, and probing per table would
        log a failing statement for every table on an older server.
        """
        engine = catalog_engine(with_child_object=False)
        dialect = VerticaDialect()

        with engine.connect() as connection:
            supports_column_comments(dialect, connection)

        # A connection that can no longer answer proves the memo is used.
        assert supports_column_comments(dialect, None) is False
