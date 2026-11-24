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
"""Disposable Postgres instance and per-test schemas owned by the v2 suite."""

from __future__ import annotations

import logging
import os
import secrets
import uuid
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, Engine
from sqlalchemy.exc import OperationalError
from tenacity import Retrying, retry_if_exception_type, stop_after_delay, wait_fixed
from testcontainers.postgres import PostgresContainer

from ..runtime.ci import mask_secrets
from .baseline import build_postgres_baseline

if TYPE_CHECKING:
    from collections.abc import Iterator

    from ..features.database.source import SqlSourceBaseline

logger = logging.getLogger(__name__)
POSTGRES_IMAGE = "postgres:16.6@sha256:557fea37a744d5f4c8faab304b0a90858b53ab119735a88c131fd19dab802f36"
_INGEST_USER_OPTION = "e2e_postgres_ingest_user"
_DATABASE = "e2e"


@dataclass(frozen=True)
class PostgresInstance:
    container: PostgresContainer = field(repr=False)
    admin_engine: Engine = field(repr=False)
    ingestion_engine: Engine = field(repr=False)


def _execute(engine: Engine, statement: str, **parameters: Any) -> None:
    with engine.begin() as connection:
        connection.execute(text(statement), parameters)


def _wait_for_postgres(engine: Engine) -> None:
    def connect():
        with engine.connect() as connection:
            assert connection.execute(text("SELECT 1")).scalar_one() == 1

    Retrying(
        retry=retry_if_exception_type(OperationalError),
        stop=stop_after_delay(90),
        wait=wait_fixed(0.25),
        reraise=True,
    )(connect)


def _restore_environment(previous: dict[str, str | None]) -> None:
    for key, value in previous.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value


@contextmanager
def fresh_postgres_instance() -> Iterator[PostgresInstance]:
    admin_password = secrets.token_urlsafe(32)
    ingest_password = secrets.token_urlsafe(32)
    ingest_user = f"om_{uuid.uuid4().hex[:20]}"
    mask_secrets(admin_password, ingest_password)
    with ExitStack() as cleanup:
        container = PostgresContainer(POSTGRES_IMAGE, username="postgres", password=admin_password, dbname=_DATABASE)
        cleanup.callback(container.stop)
        container.start()
        host = container.get_container_host_ip()
        port = int(container.get_exposed_port(5432))
        url = URL.create(
            "postgresql+psycopg2",
            username="postgres",
            password=admin_password,
            host=host,
            port=port,
            database=_DATABASE,
        )
        admin = create_engine(url, connect_args={"connect_timeout": 3}, hide_parameters=True)
        cleanup.callback(admin.dispose)
        _wait_for_postgres(admin)
        quoted_user = admin.dialect.identifier_preparer.quote_identifier(ingest_user)
        _execute(admin, f"CREATE ROLE {quoted_user} LOGIN PASSWORD :password", password=ingest_password)
        cleanup.callback(_execute, admin, f"DROP ROLE {quoted_user}")
        admin.update_execution_options(**{_INGEST_USER_OPTION: ingest_user})
        ingestion = create_engine(
            url.set(username=ingest_user, password=ingest_password),
            connect_args={"connect_timeout": 3},
            hide_parameters=True,
        )
        cleanup.callback(ingestion.dispose)
        _wait_for_postgres(ingestion)
        values = {
            "E2E_POSTGRES_USER": ingest_user,
            "E2E_POSTGRES_PASSWORD": ingest_password,
            "E2E_POSTGRES_HOST_PORT": f"{host}:{port}",
            "E2E_POSTGRES_DATABASE": _DATABASE,
        }
        cleanup.callback(_restore_environment, {key: os.environ.get(key) for key in values})
        os.environ.update(values)
        logger.info("Owned Postgres container=%s image=%s", container.get_wrapped_container().id, POSTGRES_IMAGE)
        yield PostgresInstance(container, admin, ingestion)


@dataclass
class PostgresSource:
    schema: str
    database: str
    baseline: SqlSourceBaseline
    admin_engine: Engine = field(repr=False)
    _closed: bool = field(default=False, init=False, repr=False)

    def require_active(self) -> None:
        if self._closed:
            raise ValueError("Postgres source has already been closed")

    def _table(self, name: str):
        self.require_active()
        return self.baseline.metadata.tables[f"{self.schema}.{name}"]

    def drop_table(self, name: str) -> None:
        self._table(name)
        quote = self.admin_engine.dialect.identifier_preparer.quote_identifier
        _execute(self.admin_engine, f"DROP TABLE {quote(self.schema)}.{quote(name)} CASCADE")

    def set_value(self, table: str, key: int, column: str, value: Any) -> None:
        declared = self._table(table)
        key_column = declared.c.column1 if table == "all_datatypes" else declared.c.id
        with self.admin_engine.begin() as connection:
            result = connection.execute(declared.update().where(key_column == key).values({column: value}))
            if result.rowcount != 1:
                raise ValueError(f"Expected one {table} row for key {key}, found {result.rowcount}")


def _seed_source(source: PostgresSource) -> None:
    metadata = source.baseline.metadata
    with source.admin_engine.begin() as connection:
        metadata.create_all(
            connection,
            tables=[metadata.tables[f"{source.schema}.{name}"] for name in ("customers", "transactions")],
            checkfirst=False,
        )
        for statement in source.baseline.ddl:
            connection.execute(text(statement))
        for seed in source.baseline.seeds:
            connection.execute(metadata.tables[f"{source.schema}.{seed.table_name}"].insert(), seed.rows)


def _analyze_source(source: PostgresSource) -> None:
    quote = source.admin_engine.dialect.identifier_preparer.quote_identifier
    for name in ("customers", "transactions", "all_datatypes"):
        _execute(source.admin_engine, f"ANALYZE {quote(source.schema)}.{quote(name)}")


@contextmanager
def fresh_postgres_source(admin_engine: Engine) -> Iterator[PostgresSource]:
    schema = f"e2epg{uuid.uuid4().hex}"
    quote = admin_engine.dialect.identifier_preparer.quote_identifier
    owned = quote(schema)
    user = quote(admin_engine.get_execution_options()[_INGEST_USER_OPTION])
    source = PostgresSource(schema, admin_engine.url.database, build_postgres_baseline(schema), admin_engine)
    try:
        with ExitStack() as cleanup:
            _execute(admin_engine, f"CREATE SCHEMA {owned}")
            cleanup.callback(_execute, admin_engine, f"DROP SCHEMA {owned} CASCADE")
            _execute(admin_engine, f"GRANT USAGE ON SCHEMA {owned} TO {user}")
            _execute(admin_engine, f"ALTER DEFAULT PRIVILEGES IN SCHEMA {owned} GRANT SELECT ON TABLES TO {user}")
            _seed_source(source)
            _analyze_source(source)
            _execute(admin_engine, f"GRANT SELECT ON ALL TABLES IN SCHEMA {owned} TO {user}")
            logger.info("Owned Postgres schema=%s", schema)
            yield source
    finally:
        source._closed = True
