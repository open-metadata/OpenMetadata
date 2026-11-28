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
"""Owned Redshift schemas in the configured E2E database.

Redshift cannot run in a disposable container, so isolation comes from one fresh
schema per test inside a database the E2E identity may write to. The cluster is
shared with the v1 Redshift and dbt suites, so nothing outside an owned schema is
created, changed or dropped, and no database users are created.
"""

from __future__ import annotations

import logging
import re
import uuid
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass, field
from datetime import date
from typing import TYPE_CHECKING, Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from tenacity import Retrying, retry_if_exception_type, stop_after_delay, wait_fixed

from ..runtime.ci import mask_secrets
from ..server import Env
from .baseline import CREATED_TABLES, build_redshift_baseline

if TYPE_CHECKING:
    from collections.abc import Iterator

    from sqlalchemy.engine import Engine

    from ..features.database.source import SqlSourceBaseline

logger = logging.getLogger(__name__)

HOST_PORT_ENV = "E2E_REDSHIFT_HOST_PORT"
USERNAME_ENV = "E2E_REDSHIFT_USERNAME"
PASSWORD_ENV = "E2E_REDSHIFT_PASSWORD"
DATABASE_ENV = "E2E_REDSHIFT_DB"
SCHEMA_PREFIX = "e2e_rs_"
SCHEMA_COMMENT = "owner=cli-e2e-v2"
_IDENTIFIER = re.compile(r"^[a-z_][a-z0-9_]*$")


@dataclass(frozen=True)
class RedshiftInstance:
    database: str
    admin_engine: Engine = field(repr=False)


def _execute(engine: Engine, statement: str) -> None:
    with engine.begin() as connection:
        connection.exec_driver_sql(statement)


@contextmanager
def redshift_cluster() -> Iterator[RedshiftInstance]:
    """Connect as the E2E identity to the configured database of the shared cluster."""
    host, _, port = Env(HOST_PORT_ENV).get().rpartition(":")
    password = Env(PASSWORD_ENV).get()
    mask_secrets(password)
    url = URL.create(
        "redshift+psycopg2",
        username=Env(USERNAME_ENV).get(),
        password=password,
        host=host,
        port=int(port),
        database=Env(DATABASE_ENV).get(),
    )
    with ExitStack() as cleanup:
        engine = create_engine(
            url, connect_args={"sslmode": "require", "connect_timeout": 30}, hide_parameters=True, pool_pre_ping=True
        )
        cleanup.callback(engine.dispose)
        with engine.connect() as connection:
            database = connection.execute(text("SELECT current_database()")).scalar_one()
        # The CLI names the ingested database exactly as configured; expectations use the stored name.
        if database != url.database:
            raise ValueError(f"{DATABASE_ENV} must be the database's stored name, {database}")
        logger.info("Redshift E2E cluster connected, database=%s", database)
        yield RedshiftInstance(database, engine)


@dataclass(frozen=True)
class DmlResult:
    """One DML statement's Redshift query id and its row count."""

    query_id: int
    rows: int


@dataclass
class RedshiftSource:
    instance: RedshiftInstance
    schema: str
    reference_date: date
    baseline: SqlSourceBaseline
    _closed: bool = field(default=False, init=False, repr=False)

    @property
    def database(self) -> str:
        return self.instance.database

    @property
    def qualified(self) -> str:
        return f'"{self.schema}"'

    def require_active(self) -> None:
        if self._closed:
            raise ValueError("Redshift source has already been closed")

    def _table(self, name: str):
        self.require_active()
        return self.baseline.metadata.tables[f"{self.schema}.{name}"]

    def run(self, statement: str) -> list[Any]:
        """Run one statement and return its rows, if any."""
        self.require_active()
        with self.instance.admin_engine.begin() as connection:
            result = connection.exec_driver_sql(statement)
            return list(result) if result.returns_rows else []

    def dml(self, statement: str) -> DmlResult:
        """Run one DML statement in its own transaction and return its query id and row count."""
        self.require_active()
        with self.instance.admin_engine.begin() as connection:
            rows = connection.exec_driver_sql(statement).rowcount
            query_id = connection.execute(text("SELECT pg_last_query_id()")).scalar_one()
        return DmlResult(int(query_id), rows)

    def wait_for_dml(self, *results: DmlResult, timeout: float = 180) -> None:
        """Block until STL_INSERT/STL_DELETE list every statement, so profiling cannot read a partial history."""
        if not results:
            raise ValueError("wait for at least one DML result")
        wanted = {result.query_id for result in results}
        listed = ", ".join(str(query_id) for query_id in sorted(wanted))

        def visible():
            seen = {
                row[0]
                for row in self.run(
                    f"SELECT query FROM stl_insert WHERE query IN ({listed}) "
                    f"UNION SELECT query FROM stl_delete WHERE query IN ({listed})"
                )
            }
            assert wanted <= seen, f"queries not yet in STL_INSERT/STL_DELETE: {sorted(wanted - seen)}"

        Retrying(
            retry=retry_if_exception_type(AssertionError),
            stop=stop_after_delay(timeout),
            wait=wait_fixed(3),
            reraise=True,
        )(visible)

    def drop_table(self, name: str) -> None:
        """Drop a declared table in this owned schema, with the views that depend on it."""
        declared = self._table(name)
        _execute(self.instance.admin_engine, f'DROP TABLE {self.qualified}."{declared.name}" CASCADE')

    def set_value(self, table: str, key: int, column: str, value: Any) -> None:
        """Update one declared column by primary key in this owned schema."""
        declared = self._table(table)
        with self.instance.admin_engine.begin() as connection:
            result = connection.execute(declared.update().where(declared.c.id == key).values({column: value}))
            if result.rowcount != 1:
                raise ValueError(f"Expected one {table} row for key {key}, found {result.rowcount}")

    def set_description(self, table: str, description: str) -> None:
        declared = self._table(table)
        escaped = description.replace("'", "''")
        self.run(f"COMMENT ON TABLE {self.qualified}.\"{declared.name}\" IS '{escaped}'")


def _seed_source(source: RedshiftSource) -> None:
    metadata = source.baseline.metadata
    with source.instance.admin_engine.begin() as connection:
        metadata.create_all(
            connection,
            tables=[metadata.tables[f"{source.schema}.{name}"] for name in CREATED_TABLES],
            checkfirst=False,
        )
        for seed in source.baseline.seeds:
            connection.execute(metadata.tables[f"{source.schema}.{seed.table_name}"].insert(), seed.rows)
        for statement in source.baseline.ddl:
            connection.exec_driver_sql(statement)


@contextmanager
def fresh_redshift_source(
    instance: RedshiftInstance, *, reference_date: date | None = None
) -> Iterator[RedshiftSource]:
    """Create and seed one fresh schema, attempting the drop even on partial setup failure."""
    schema = f"{SCHEMA_PREFIX}{uuid.uuid4().hex}"
    if not _IDENTIFIER.match(schema):
        raise ValueError("generated schema name is not a plain identifier")
    reference = reference_date or date.today()
    source = RedshiftSource(instance, schema, reference, build_redshift_baseline(schema, reference_date=reference))
    try:
        with ExitStack() as cleanup:
            # The unique name makes the drop safe to register before a CREATE whose response can be lost.
            cleanup.callback(_execute, instance.admin_engine, f"DROP SCHEMA IF EXISTS {source.qualified} CASCADE")
            _execute(instance.admin_engine, f"CREATE SCHEMA {source.qualified}")
            _execute(instance.admin_engine, f"COMMENT ON SCHEMA {source.qualified} IS '{SCHEMA_COMMENT}'")
            _seed_source(source)
            logger.info("Owned Redshift schema=%s.%s", instance.database, schema)
            yield source
    finally:
        source._closed = True
