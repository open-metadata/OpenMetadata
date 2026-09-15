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
"""Unit tests for Vertica connection handling."""

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy_vertica.dialect_vertica_python import VerticaDialect

# The dialect corrections are applied as an import side effect of the connector's
# metadata module, and this is the dialect the vertica_python scheme actually
# builds, so both are needed for these tests to reflect a real ingestion.
import metadata.ingestion.source.database.vertica.metadata  # noqa: F401
from metadata.generated.schema.entity.services.connections.database.verticaConnection import (
    VerticaConnection as VerticaConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.verticaConnection import (
    VerticaScheme,
)
from metadata.ingestion.source.database.vertica.connection import VerticaConnection


def test_basic_auth_builds_expected_url():
    connection = VerticaConnectionConfig(
        username="openmetadata_user",
        password="openmetadata_password",
        hostPort="localhost:5433",
        database="openmetadata_db",
        scheme=VerticaScheme.vertica_vertica_python,
    )
    engine = VerticaConnection(connection).client
    assert (
        engine.url.render_as_string(hide_password=False)
        == "vertica+vertica_python://openmetadata_user:openmetadata_password@localhost:5433/openmetadata_db"
    )


def test_special_characters_in_credentials_are_escaped():
    connection = VerticaConnectionConfig(
        username="openmetadata_user@444",
        password="openmetadata_password@123",
        hostPort="localhost:5433",
        database="openmetadata_db",
        scheme=VerticaScheme.vertica_vertica_python,
    )
    engine = VerticaConnection(connection).client
    assert (
        engine.url.render_as_string(hide_password=False)
        == "vertica+vertica_python://openmetadata_user%40444:openmetadata_password%40123@localhost:5433/openmetadata_db"
    )


@pytest.fixture(name="dialect_probe_engine")
def dialect_probe_engine_fixture():
    """A real SQLAlchemy engine that answers the two statements the Vertica
    dialect issues while initializing.

    SQLite stands in for the server on purpose. Both statements are rejected by
    SQLAlchemy before they reach any database when they are passed as raw
    strings, so the failure these tests guard against reproduces on any engine.
    Registering the two functions lets the statements actually execute, which
    means the assertions cover the parsing too, not just the call.
    """
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def _register_vertica_functions(dbapi_connection, _):  # pyright: ignore[reportUnusedFunction]
        dbapi_connection.create_function("version", 0, lambda: "Vertica Analytic Database v9.2.0-7")
        dbapi_connection.create_function("current_schema", 0, lambda: "omd_test")

    return engine


def test_server_version_is_executable_under_sqlalchemy_2(dialect_probe_engine):
    """sqlalchemy-vertica passes a raw string to Connection.scalar(), which
    SQLAlchemy 2.x rejects with ObjectNotExecutableError while the dialect is
    initializing. That surfaces to users as a failed CheckAccess step.
    """
    with dialect_probe_engine.connect() as connection:
        assert VerticaDialect()._get_server_version_info(connection) == (9, 2, 0)


def test_default_schema_is_executable_under_sqlalchemy_2(dialect_probe_engine):
    """Same defect as the server version, in the method initialize() calls
    straight after it. Fixing only the version leaves this one failing.
    """
    with dialect_probe_engine.connect() as connection:
        assert VerticaDialect()._get_default_schema_name(connection) == "omd_test"


@pytest.mark.parametrize(
    "batched_reflection_method",
    [
        "get_multi_columns",
        "get_multi_pk_constraint",
        "get_multi_foreign_keys",
        "get_multi_indexes",
        "get_multi_table_comment",
        "get_multi_unique_constraints",
        "get_multi_check_constraints",
    ],
)
def test_batched_reflection_does_not_fall_through_to_postgres(batched_reflection_method: str):
    """MetaData.reflect() uses SQLAlchemy 2.x batched reflection.

    sqlalchemy-vertica only overrides the singular get_* methods, so every
    batched one inherits PGDialect's implementation and queries pg_catalog,
    which Vertica does not have. Reflection then fails with MissingSchema and
    tables end up with no schema definition.
    """
    resolved = getattr(VerticaDialect, batched_reflection_method)

    assert not resolved.__module__.startswith("sqlalchemy.dialects.postgresql"), (
        f"{batched_reflection_method} resolves to {resolved.__module__}, which reads pg_catalog"
    )
