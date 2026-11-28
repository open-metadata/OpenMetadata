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
"""Disposable Exasol instance, a least-privilege ingestion user, and per-test schemas.

The session owns the container and one ingestion user; each test owns a fresh
schema. The ingestion user owns nothing: it holds ``CREATE SESSION``,
``SELECT ANY DICTIONARY`` (the usage and system-metric queries read
``EXA_STATISTICS.EXA_DBA_AUDIT_*``) and ``SELECT`` on exactly the owned schemas.
"""

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
from sqlalchemy.exc import DBAPIError
from tenacity import Retrying, retry_if_exception_type, stop_after_delay, wait_fixed
from testcontainers.core.container import DockerContainer

from ..runtime.ci import mask_secrets
from .baseline import NATIVE_TABLE, NATIVE_VIEW, build_exasol_baseline

if TYPE_CHECKING:
    from collections.abc import Iterator

    from ..features.database.source import SqlSourceBaseline

logger = logging.getLogger(__name__)
# The version v1 and the Exasol integration tests pin. The image is published for
# amd64 only and must run privileged.
EXASOL_IMAGE = "exasol/docker-db:2025.1.8@sha256:059715efa987de57488ccfe275154594aab7222211ddd926b7113df4d6f81cef"
EXASOL_PORT = 8563
# The image's documented default administrator; the container is private to the session.
_ADMIN_USER = "sys"
_ADMIN_PASSWORD = "exasol"
INGEST_USER_OPTION = "e2e_exasol_ingest_user"
# A cold boot initialises the database inside the container; under amd64
# emulation on an arm64 machine that takes several minutes.
_STARTUP_TIMEOUT_SECONDS = 900


@dataclass(frozen=True)
class ExasolInstance:
    container: DockerContainer = field(repr=False)
    admin_engine: Engine = field(repr=False)
    ingestion_engine: Engine = field(repr=False)


def _execute(engine: Engine, statement: str, **parameters: Any) -> None:
    with engine.begin() as connection:
        connection.execute(text(statement), parameters)


def _url(host: str, port: int, username: str, password: str) -> URL:
    # The container serves a self-signed certificate.
    return URL.create(
        "exa+websocket",
        username=username,
        password=password,
        host=host,
        port=port,
        query={"SSLCertificate": "SSL_VERIFY_NONE"},
    )


def _wait_for_exasol(engine: Engine) -> None:
    def connect():
        with engine.connect() as connection:
            assert connection.execute(text("SELECT 1")).scalar_one() == 1

    Retrying(
        retry=retry_if_exception_type((DBAPIError, OSError, TimeoutError, ConnectionError)),
        stop=stop_after_delay(_STARTUP_TIMEOUT_SECONDS),
        wait=wait_fixed(5),
        reraise=True,
    )(connect)


def _restore_environment(previous: dict[str, str | None]) -> None:
    for key, value in previous.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value


@contextmanager
def fresh_exasol_instance() -> Iterator[ExasolInstance]:
    """Provision a private container and a restricted ingestion user."""
    ingest_password = f"Aa1{secrets.token_hex(24)}"
    ingest_user = f"om_{uuid.uuid4().hex[:20]}"
    mask_secrets(ingest_password)
    with ExitStack() as cleanup:
        container = (
            DockerContainer(EXASOL_IMAGE)
            .with_exposed_ports(EXASOL_PORT)
            .with_kwargs(privileged=True, platform="linux/amd64")
        )
        cleanup.callback(container.stop)
        try:
            container.start()
            host = container.get_container_host_ip()
            port = int(container.get_exposed_port(EXASOL_PORT))
            admin = create_engine(_url(host, port, _ADMIN_USER, _ADMIN_PASSWORD), hide_parameters=True)
            cleanup.callback(admin.dispose)
            _wait_for_exasol(admin)
        except Exception:
            if container.get_wrapped_container() is not None:
                stdout, stderr = container.get_logs()
                logger.error("Exasol startup failed:\n%s", (stdout + stderr).decode(errors="replace")[-20000:])
            raise

        # A password cannot be bound in DDL and hide_parameters only redacts bound
        # values, so a failure message would carry the statement and the password.
        try:
            _execute(admin, f'CREATE USER {ingest_user} IDENTIFIED BY "{ingest_password}"')
        except Exception as error:
            raise RuntimeError(f"Could not create the ingestion user {ingest_user}: {type(error).__name__}") from None
        cleanup.callback(_execute, admin, f"DROP USER {ingest_user} CASCADE")
        _execute(admin, f"GRANT CREATE SESSION TO {ingest_user}")
        _execute(admin, f"GRANT SELECT ANY DICTIONARY TO {ingest_user}")
        admin.update_execution_options(**{INGEST_USER_OPTION: ingest_user})

        ingestion = create_engine(_url(host, port, ingest_user, ingest_password), hide_parameters=True)
        cleanup.callback(ingestion.dispose)
        _wait_for_exasol(ingestion)
        values = {
            "E2E_EXASOL_USER": ingest_user,
            "E2E_EXASOL_PASSWORD": ingest_password,
            "E2E_EXASOL_HOST_PORT": f"{host}:{port}",
        }
        cleanup.callback(_restore_environment, {key: os.environ.get(key) for key in values})
        os.environ.update(values)
        logger.info("Owned Exasol container=%s image=%s", container.get_wrapped_container().id, EXASOL_IMAGE)
        yield ExasolInstance(container, admin, ingestion)


@dataclass
class ExasolSource:
    schema: str
    baseline: SqlSourceBaseline
    admin_engine: Engine = field(repr=False)
    _closed: bool = field(default=False, init=False, repr=False)

    def require_active(self) -> None:
        if self._closed:
            raise ValueError("Exasol source has already been closed")

    def _table(self, name: str):
        self.require_active()
        return self.baseline.metadata.tables[f"{self.schema}.{name}"]

    def drop_table(self, name: str) -> None:
        """Drop a declared table in this owned schema, with the view built on the native table."""
        self._table(name)
        if name == NATIVE_TABLE:
            _execute(self.admin_engine, f"DROP VIEW IF EXISTS {self.schema}.{NATIVE_VIEW}")
        _execute(self.admin_engine, f"DROP TABLE {self.schema}.{name} CASCADE CONSTRAINTS")

    def set_value(self, table: str, key: int, column: str, value: Any) -> None:
        """Update one declared column by primary key in this owned schema."""
        declared = self._table(table)
        with self.admin_engine.begin() as connection:
            result = connection.execute(declared.update().where(declared.c.id == key).values({column: value}))
            if result.rowcount != 1:
                raise ValueError(f"Expected one {table} row for key {key}, found {result.rowcount}")

    def execute(self, statement: str, **parameters: Any) -> None:
        """Run one owned-schema statement the scenarios need beyond the declarations."""
        self.require_active()
        _execute(self.admin_engine, statement, **parameters)


def _seed_source(source: ExasolSource) -> None:
    metadata = source.baseline.metadata
    with source.admin_engine.begin() as connection:
        metadata.create_all(connection, checkfirst=False)
        for seed in source.baseline.seeds:
            connection.execute(metadata.tables[f"{source.schema}.{seed.table_name}"].insert(), seed.rows)
        for statement in source.baseline.ddl:
            connection.execute(text(statement))


@contextmanager
def fresh_exasol_source(admin_engine: Engine) -> Iterator[ExasolSource]:
    """Create one fresh schema; remove it on success and on failure."""
    # Lower case so OM stores it as SQLAlchemy reports it; Exasol itself holds it upper case.
    schema = f"e2eexa{uuid.uuid4().hex}"
    user = admin_engine.get_execution_options()[INGEST_USER_OPTION]
    source = ExasolSource(schema=schema, baseline=build_exasol_baseline(schema), admin_engine=admin_engine)
    try:
        with ExitStack() as cleanup:
            _execute(admin_engine, f"CREATE SCHEMA {schema}")
            cleanup.callback(_execute, admin_engine, f"DROP SCHEMA {schema} CASCADE")
            _seed_source(source)
            _execute(admin_engine, f"GRANT SELECT ON SCHEMA {schema} TO {user}")
            logger.info("Owned Exasol schema=%s", schema)
            yield source
    finally:
        source._closed = True
