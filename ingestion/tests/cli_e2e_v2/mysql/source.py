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
"""Owned MySQL instances and fresh schema lifetimes for connector tests."""

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
from testcontainers.mysql import MySqlContainer

from ..runtime.ci import mask_secrets
from .baseline import build_mysql_baseline

if TYPE_CHECKING:
    from collections.abc import Iterator

    from ..features.database.source import SqlSourceBaseline

logger = logging.getLogger(__name__)
MYSQL_IMAGE = "mysql:8.0.44@sha256:9c3380eac945af0736031b200027f581925927c81e010056214a4bd6b6693714"
_INGEST_USER_OPTION = "e2e_mysql_ingest_user"


@dataclass(frozen=True)
class MySqlInstance:
    container: MySqlContainer = field(repr=False)
    admin_engine: Engine = field(repr=False)
    ingestion_engine: Engine = field(repr=False)


def _execute(engine: Engine, statement: str, **parameters: Any) -> None:
    with engine.begin() as connection:
        connection.execute(text(statement), parameters)


def _wait_for_mysql(engine: Engine) -> None:
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
def fresh_mysql_instance() -> Iterator[MySqlInstance]:
    """Provision a private container and restricted account, restoring the environment on exit."""
    root_password = secrets.token_urlsafe(32)
    ingest_password = secrets.token_urlsafe(32)
    ingest_user = f"om_{uuid.uuid4().hex[:20]}"
    mask_secrets(root_password, ingest_password)
    with ExitStack() as cleanup:
        container = MySqlContainer(MYSQL_IMAGE, username="root", password=root_password, dbname="bootstrap")
        cleanup.callback(container.stop)
        try:
            container.start()
            host = container.get_container_host_ip()
            port = int(container.get_exposed_port(3306))
            url = URL.create("mysql+pymysql", username="root", password=root_password, host=host, port=port)
            admin = create_engine(url, connect_args={"connect_timeout": 3}, hide_parameters=True)
            cleanup.callback(admin.dispose)
            _wait_for_mysql(admin)
        except Exception:
            if container.get_wrapped_container() is not None:
                stdout, stderr = container.get_logs()
                logger.error("MySQL startup failed:\n%s", (stdout + stderr).decode(errors="replace"))
            raise

        _execute(admin, "CREATE USER :user@'%' IDENTIFIED BY :password", user=ingest_user, password=ingest_password)
        cleanup.callback(_execute, admin, "DROP USER :user@'%'", user=ingest_user)
        _execute(admin, "GRANT PROCESS, SHOW_ROUTINE ON *.* TO :user@'%'", user=ingest_user)
        admin.update_execution_options(**{_INGEST_USER_OPTION: ingest_user})
        ingestion = create_engine(
            url.set(username=ingest_user, password=ingest_password),
            connect_args={"connect_timeout": 3},
            hide_parameters=True,
        )
        cleanup.callback(ingestion.dispose)
        _wait_for_mysql(ingestion)
        values = {
            "E2E_MYSQL_USER": ingest_user,
            "E2E_MYSQL_PASSWORD": ingest_password,
            "E2E_MYSQL_HOST_PORT": f"{host}:{port}",
        }
        cleanup.callback(_restore_environment, {key: os.environ.get(key) for key in values})
        os.environ.update(values)
        logger.info("Owned MySQL container=%s image=%s", container.get_wrapped_container().id, MYSQL_IMAGE)
        yield MySqlInstance(container, admin, ingestion)


@dataclass
class MySqlSource:
    schema: str
    baseline: SqlSourceBaseline
    admin_engine: Engine = field(repr=False)
    _closed: bool = field(default=False, init=False, repr=False)

    def require_active(self) -> None:
        if self._closed:
            raise ValueError("MySQL source has already been closed")

    def _table(self, name: str):
        self.require_active()
        return self.baseline.metadata.tables[f"{self.schema}.{name}"]

    def drop_table(self, name: str) -> None:
        """Drop a declared table in this owned schema."""
        self._table(name).drop(self.admin_engine)

    def set_value(self, table: str, key: int, column: str, value: Any) -> None:
        """Update one declared column by primary key in this owned schema."""
        declared = self._table(table)
        target_column = declared.c[column]
        with self.admin_engine.begin() as connection:
            result = connection.execute(declared.update().where(declared.c.id == key).values({target_column: value}))
            if result.rowcount != 1:
                raise ValueError(f"Expected one {table} row for key {key}, found {result.rowcount}")


def _revoke_schema_grant(engine: Engine, quoted: str, user: str) -> None:
    _execute(engine, f"REVOKE SELECT, SHOW VIEW, EXECUTE ON {quoted}.* FROM :user@'%'", user=user)


def _seed_source(source: MySqlSource) -> None:
    with source.admin_engine.begin() as connection:
        source.baseline.metadata.create_all(connection, checkfirst=False)
        for seed in source.baseline.seeds:
            table = source.baseline.metadata.tables[f"{source.schema}.{seed.table_name}"]
            connection.execute(table.insert(), seed.rows)
        for statement in source.baseline.ddl:
            connection.execute(text(statement))


@contextmanager
def fresh_mysql_source(admin_engine: Engine) -> Iterator[MySqlSource]:
    """Create and grant one fresh schema; attempt every cleanup even on partial setup failure."""
    user = admin_engine.get_execution_options()[_INGEST_USER_OPTION]
    # Alphanumeric names avoid MySQL GRANT's '_' and '%' wildcard semantics.
    schema = f"e2emysql{uuid.uuid4().hex}"
    quoted = admin_engine.dialect.identifier_preparer.quote_identifier(schema)
    source = MySqlSource(schema, build_mysql_baseline(schema), admin_engine)
    try:
        with ExitStack() as cleanup:
            _execute(admin_engine, f"CREATE DATABASE {quoted}")
            cleanup.callback(_execute, admin_engine, f"DROP DATABASE {quoted}")
            _execute(admin_engine, f"GRANT SELECT, SHOW VIEW, EXECUTE ON {quoted}.* TO :user@'%'", user=user)
            cleanup.callback(_revoke_schema_grant, admin_engine, quoted, user)
            _seed_source(source)
            logger.info("Owned MySQL schema=%s", schema)
            yield source
    finally:
        source._closed = True
