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
"""Disposable SQL Server instance, one owned database, and per-test schemas.

The session owns the container, one database and one least-privilege login; each
test owns a fresh schema inside that database. The ingestion account never owns
an object: it receives ``SELECT`` and ``VIEW DEFINITION`` on exactly the owned
schemas, which is what the connector needs to read tables, view definitions and
extended-property descriptions.
"""

from __future__ import annotations

import logging
import os
import secrets
import uuid
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass, field
from datetime import date
from typing import TYPE_CHECKING, Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, Engine
from sqlalchemy.exc import DBAPIError
from tenacity import Retrying, retry_if_exception_type, stop_after_delay, wait_fixed
from testcontainers.mssql import SqlServerContainer

from ..runtime.ci import mask_secrets
from .baseline import NATIVE_TABLE, NATIVE_VIEW, build_mssql_baseline

if TYPE_CHECKING:
    from collections.abc import Iterator

    from ..features.database.source import SqlSourceBaseline

logger = logging.getLogger(__name__)
MSSQL_IMAGE = (
    "mcr.microsoft.com/mssql/server:2022-latest@sha256:4402d880dd4c34bfa7d8705e56a86cd6c88da80a1f6bbbe741f999e76264a090"
)
INGEST_USER_OPTION = "e2e_mssql_ingest_user"
# The image is published for amd64 only, so an arm64 runner emulates it and the
# first boot is slow; the Oracle suite needs the same order of budget.
_STARTUP_TIMEOUT_SECONDS = 600


class _MssqlContainer(SqlServerContainer):
    """SqlServerContainer whose readiness is decided by this suite, not by the base class.

    testcontainers 4.8 — the version CI pins — waits by exec'ing
    ``/opt/mssql-tools/bin/sqlcmd`` without ``-C``. The 2022 image ships
    ``mssql-tools18`` and requires ``-C``, so that probe can never succeed and the
    start fails with an opaque timeout. Readiness is established instead by
    ``_wait_for_mssql`` over the same driver the connector uses.
    """

    def _connect(self) -> None:
        return None


@dataclass(frozen=True)
class MssqlInstance:
    container: SqlServerContainer = field(repr=False)
    admin_engine: Engine = field(repr=False)
    ingestion_engine: Engine = field(repr=False)
    database: str


def _execute(engine: Engine, statement: str, **parameters: Any) -> None:
    with engine.begin() as connection:
        connection.execute(text(statement), parameters)


def _wait_for_mssql(engine: Engine) -> None:
    def connect():
        with engine.connect() as connection:
            assert connection.execute(text("SELECT 1")).scalar_one() == 1

    Retrying(
        retry=retry_if_exception_type((DBAPIError, OSError, TimeoutError)),
        stop=stop_after_delay(_STARTUP_TIMEOUT_SECONDS),
        wait=wait_fixed(2),
        reraise=True,
    )(connect)


def _restore_environment(previous: dict[str, str | None]) -> None:
    for key, value in previous.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value


def _password() -> str:
    """A password SQL Server's complexity policy accepts, whatever the random suffix is."""
    return f"Aa1{secrets.token_urlsafe(32)}"


def _url(host: str, port: int, username: str, password: str, database: str) -> URL:
    return URL.create("mssql+pytds", username=username, password=password, host=host, port=port, database=database)


def _drop_database(engine: Engine, database: str) -> None:
    """Drop the owned database, evicting any session the CLI left behind."""
    quoted = engine.dialect.identifier_preparer.quote_identifier(database)
    _execute(engine, f"ALTER DATABASE {quoted} SET SINGLE_USER WITH ROLLBACK IMMEDIATE")
    _execute(engine, f"DROP DATABASE {quoted}")


@contextmanager
def fresh_mssql_instance() -> Iterator[MssqlInstance]:
    """Provision a private container, one owned database and a restricted login."""
    sa_password = _password()
    ingest_password = _password()
    ingest_user = f"om_{uuid.uuid4().hex[:20]}"
    # Avoids the connector's default database excludes (^msdb$, ^model$, ^tempdb$).
    database = f"e2emssql{uuid.uuid4().hex[:16]}"
    mask_secrets(sa_password, ingest_password)
    with ExitStack() as cleanup:
        container = _MssqlContainer(MSSQL_IMAGE, password=sa_password, dbname="master")
        cleanup.callback(container.stop)
        try:
            container.start()
            host = container.get_container_host_ip()
            port = int(container.get_exposed_port(1433))
            # CREATE DATABASE and ALTER DATABASE ... SINGLE_USER cannot run inside a
            # transaction, so the master connection commits every statement itself.
            # pytds carries this on the connection; the dialect rejects SQLAlchemy's
            # own isolation_level="AUTOCOMMIT".
            master = create_engine(
                _url(host, port, "SA", sa_password, "master"),
                connect_args={"autocommit": True},
                hide_parameters=True,
            )
            cleanup.callback(master.dispose)
            _wait_for_mssql(master)
        except Exception:
            if container.get_wrapped_container() is not None:
                stdout, stderr = container.get_logs()
                logger.error("SQL Server startup failed:\n%s", (stdout + stderr).decode(errors="replace"))
            raise

        quote = master.dialect.identifier_preparer.quote_identifier
        _execute(master, f"CREATE DATABASE {quote(database)}")
        cleanup.callback(_drop_database, master, database)
        # A password cannot be bound as a parameter in DDL, and SQLAlchemy's
        # hide_parameters only redacts bound values, so a failure here would carry the
        # statement text — and the password — in its message. CHECK_POLICY = OFF keeps
        # the generated password independent of the host's policy.
        try:
            _execute(
                master,
                f"CREATE LOGIN {quote(ingest_user)} WITH PASSWORD = '{ingest_password}', CHECK_POLICY = OFF",
            )
        except Exception as error:
            raise RuntimeError(f"Could not create the ingestion login {ingest_user}: {type(error).__name__}") from None
        cleanup.callback(_execute, master, f"DROP LOGIN {quote(ingest_user)}")

        admin = create_engine(
            _url(host, port, "SA", sa_password, database),
            hide_parameters=True,
        )
        cleanup.callback(admin.dispose)
        _wait_for_mssql(admin)
        _execute(admin, f"CREATE USER {quote(ingest_user)} FOR LOGIN {quote(ingest_user)}")
        # The profiler's table metrics read sys.dm_db_partition_stats for every table,
        # and the connector has no fallback for a permission error there. Reading that
        # DMV is the one database-wide right the ingestion account needs; it grants no
        # data access and no write of any kind.
        _execute(admin, f"GRANT VIEW DATABASE PERFORMANCE STATE TO {quote(ingest_user)}")
        admin.update_execution_options(**{INGEST_USER_OPTION: ingest_user})

        ingestion = create_engine(
            _url(host, port, ingest_user, ingest_password, database),
            hide_parameters=True,
        )
        cleanup.callback(ingestion.dispose)
        _wait_for_mssql(ingestion)
        values = {
            "E2E_MSSQL_USER": ingest_user,
            "E2E_MSSQL_PASSWORD": ingest_password,
            "E2E_MSSQL_HOST_PORT": f"{host}:{port}",
            "E2E_MSSQL_DATABASE": database,
        }
        cleanup.callback(_restore_environment, {key: os.environ.get(key) for key in values})
        os.environ.update(values)
        logger.info("Owned SQL Server container=%s image=%s", container.get_wrapped_container().id, MSSQL_IMAGE)
        yield MssqlInstance(container, admin, ingestion, database)


@dataclass
class MssqlSource:
    schema: str
    database: str
    baseline: SqlSourceBaseline
    reference_date: date
    admin_engine: Engine = field(repr=False)
    _closed: bool = field(default=False, init=False, repr=False)

    def require_active(self) -> None:
        if self._closed:
            raise ValueError("MSSQL source has already been closed")

    def _table(self, name: str):
        self.require_active()
        return self.baseline.metadata.tables[f"{self.schema}.{name}"]

    def drop_table(self, name: str) -> None:
        """Drop a declared table in this owned schema, with any view built on it.

        SQL Server has no DROP TABLE ... CASCADE, so the dependent view goes first.
        """
        self._table(name)
        quote = self.admin_engine.dialect.identifier_preparer.quote_identifier
        if name == NATIVE_TABLE:
            _execute(self.admin_engine, f"DROP VIEW IF EXISTS {quote(self.schema)}.{quote(NATIVE_VIEW)}")
        _execute(self.admin_engine, f"DROP TABLE {quote(self.schema)}.{quote(name)}")

    def set_value(self, table: str, key: int, column: str, value: Any) -> None:
        """Update one declared column by primary key in this owned schema."""
        declared = self._table(table)
        key_column = declared.c.person_id if table == "persons" else declared.c.id
        with self.admin_engine.begin() as connection:
            result = connection.execute(declared.update().where(key_column == key).values({column: value}))
            if result.rowcount != 1:
                raise ValueError(f"Expected one {table} row for key {key}, found {result.rowcount}")

    def execute(self, statement: str, **parameters: Any) -> None:
        """Run one owned-schema statement the scenarios need beyond the declarations."""
        self.require_active()
        _execute(self.admin_engine, statement, **parameters)


def _seed_source(source: MssqlSource) -> None:
    metadata = source.baseline.metadata
    with source.admin_engine.begin() as connection:
        metadata.create_all(connection, checkfirst=False)
        for statement in source.baseline.ddl:
            connection.execute(text(statement))
        for seed in source.baseline.seeds:
            connection.execute(metadata.tables[f"{source.schema}.{seed.table_name}"].insert(), seed.rows)


_DROP_BY_OBJECT_TYPE = {"V": "DROP VIEW", "P": "DROP PROCEDURE", "U": "DROP TABLE"}


def _drop_schema(engine: Engine, schema: str) -> None:
    """Remove every object the schema owns, then the schema: SQL Server has no DROP SCHEMA ... CASCADE."""
    quote = engine.dialect.identifier_preparer.quote_identifier
    owned = quote(schema)
    with engine.connect() as connection:
        foreign_keys = connection.execute(
            text(
                "SELECT f.name, t.name FROM sys.foreign_keys f "
                "JOIN sys.tables t ON t.object_id = f.parent_object_id "
                "JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE s.name = :schema"
            ),
            {"schema": schema},
        ).all()
        objects = connection.execute(
            text(
                "SELECT o.name, o.type FROM sys.objects o JOIN sys.schemas s ON s.schema_id = o.schema_id "
                "WHERE s.name = :schema AND o.type IN ('V', 'P', 'U')"
            ),
            {"schema": schema},
        ).all()
    # Dropping the references first makes the table order irrelevant.
    for constraint, table in foreign_keys:
        _execute(engine, f"ALTER TABLE {owned}.{quote(table)} DROP CONSTRAINT {quote(constraint)}")
    for name, object_type in objects:
        _execute(engine, f"{_DROP_BY_OBJECT_TYPE[object_type.strip()]} {owned}.{quote(name)}")
    _execute(engine, f"DROP SCHEMA {owned}")


@contextmanager
def fresh_mssql_source(admin_engine: Engine) -> Iterator[MssqlSource]:
    """Create one fresh schema in the owned database; remove it on success and on failure."""
    # Avoids the connector's default schema excludes (^db_.*, ^guest$, ^sys$, ^information_schema$).
    schema = f"e2emssql{uuid.uuid4().hex}"
    quote = admin_engine.dialect.identifier_preparer.quote_identifier
    owned = quote(schema)
    user = quote(admin_engine.get_execution_options()[INGEST_USER_OPTION])
    reference_date = date.today()
    source = MssqlSource(
        schema=schema,
        database=admin_engine.url.database,
        baseline=build_mssql_baseline(schema, reference_date=reference_date),
        reference_date=reference_date,
        admin_engine=admin_engine,
    )
    try:
        with ExitStack() as cleanup:
            _execute(admin_engine, f"CREATE SCHEMA {owned}")
            cleanup.callback(_drop_schema, admin_engine, schema)
            _seed_source(source)
            _execute(admin_engine, f"GRANT SELECT, VIEW DEFINITION ON SCHEMA::{owned} TO {user}")
            logger.info("Owned MSSQL schema=%s", schema)
            yield source
    finally:
        source._closed = True
