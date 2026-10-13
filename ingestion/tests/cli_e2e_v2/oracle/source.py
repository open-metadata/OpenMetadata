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
"""Owned Oracle instances and fresh schema lifetimes for connector tests.

In Oracle a schema *is* a user, so a fresh source creates a dedicated user,
grants it a tablespace quota, and drops it with ``CASCADE`` on teardown. The
separate ingestion account never owns objects: it receives ``CREATE SESSION``,
``SELECT_CATALOG_ROLE`` for the ``DBA_`` dictionary views the connector reads by
default, and per-object ``SELECT`` on exactly the owned schema.
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
from sqlalchemy.exc import DatabaseError, OperationalError
from tenacity import Retrying, retry_if_exception_type, stop_after_delay, wait_fixed
from testcontainers.core.waiting_utils import wait_for_logs
from testcontainers.oracle import OracleDbContainer

from ..runtime.ci import mask_secrets
from .baseline import build_oracle_baseline

if TYPE_CHECKING:
    from collections.abc import Iterator

    from ..features.database.source import SqlSourceBaseline

logger = logging.getLogger(__name__)
ORACLE_IMAGE = (
    "gvenzl/oracle-free:23-slim-faststart@sha256:f5ff19033860d662c821cb04eb10483fa94f14f78eae252d054291ea07028093"
)
ORACLE_SERVICE_NAME = "FREEPDB1"
INGEST_USER_OPTION = "e2e_oracle_ingest_user"
# oracle-free's first boot initialises the PDB; well beyond MySQL's 90s.
_STARTUP_TIMEOUT_SECONDS = 600


class _OracleContainer(OracleDbContainer):
    """OracleDbContainer with a startup wait long enough for a cold PDB initialise.

    The base class waits on the readiness log line with testcontainers' default
    120s budget. oracle-free normally beats that, but on a loaded runner — which
    is exactly the CI case, after a 6GB image pull — it does not, and the failure
    surfaces as an opaque ``TimeoutError`` from ``wait_for_logs`` rather than
    anything Oracle-shaped.
    """

    def _connect(self) -> None:
        wait_for_logs(self, "DATABASE IS READY TO USE!", timeout=_STARTUP_TIMEOUT_SECONDS)


@dataclass(frozen=True)
class OracleInstance:
    container: OracleDbContainer = field(repr=False)
    admin_engine: Engine = field(repr=False)
    ingestion_engine: Engine = field(repr=False)
    service_name: str = ORACLE_SERVICE_NAME


def _execute(engine: Engine, statement: str, **parameters: Any) -> None:
    with engine.begin() as connection:
        connection.execute(text(statement), parameters)


def _wait_for_oracle(engine: Engine) -> None:
    def connect():
        with engine.connect() as connection:
            assert connection.execute(text("SELECT 1 FROM dual")).scalar_one() == 1

    Retrying(
        retry=retry_if_exception_type((OperationalError, DatabaseError)),
        stop=stop_after_delay(_STARTUP_TIMEOUT_SECONDS),
        wait=wait_fixed(1),
        reraise=True,
    )(connect)


def _restore_environment(previous: dict[str, str | None]) -> None:
    for key, value in previous.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value


def _admin_url(host: str, port: int, password: str) -> URL:
    return URL.create(
        "oracle+oracledb",
        username="system",
        password=password,
        host=host,
        port=port,
        query={"service_name": ORACLE_SERVICE_NAME},
    )


@contextmanager
def fresh_oracle_instance() -> Iterator[OracleInstance]:
    """Provision a private container and restricted account, restoring the environment on exit."""
    system_password = secrets.token_urlsafe(32)
    ingest_password = secrets.token_urlsafe(32)
    # Oracle folds unquoted identifiers to uppercase; declare the account uppercase
    # so the created name and every later reference agree without quoting.
    ingest_user = f"OM_{uuid.uuid4().hex[:20].upper()}"
    mask_secrets(system_password, ingest_password)
    with ExitStack() as cleanup:
        container = _OracleContainer(ORACLE_IMAGE, oracle_password=system_password)
        cleanup.callback(container.stop)
        try:
            container.start()
            host = container.get_container_host_ip()
            port = int(container.get_exposed_port(1521))
            url = _admin_url(host, port, system_password)
            admin = create_engine(url, hide_parameters=True)
            cleanup.callback(admin.dispose)
            _wait_for_oracle(admin)
        except Exception:
            if container.get_wrapped_container() is not None:
                stdout, stderr = container.get_logs()
                logger.error("Oracle startup failed:\n%s", (stdout + stderr).decode(errors="replace"))
            raise

        # Identifiers cannot be bound as parameters in DDL; they are generated above, not user input.
        _execute(admin, f'CREATE USER {ingest_user} IDENTIFIED BY "{ingest_password}"')
        cleanup.callback(_execute, admin, f"DROP USER {ingest_user} CASCADE")
        _execute(admin, f"GRANT CREATE SESSION TO {ingest_user}")
        # The connector reads DBA_ dictionary views unless useDBATable is disabled.
        _execute(admin, f"GRANT SELECT_CATALOG_ROLE TO {ingest_user}")
        admin.update_execution_options(**{INGEST_USER_OPTION: ingest_user})
        ingestion = create_engine(
            url.set(username=ingest_user, password=ingest_password),
            hide_parameters=True,
        )
        cleanup.callback(ingestion.dispose)
        _wait_for_oracle(ingestion)
        values = {
            "E2E_ORACLE_USER": ingest_user,
            "E2E_ORACLE_PASSWORD": ingest_password,
            "E2E_ORACLE_HOST_PORT": f"{host}:{port}",
            "E2E_ORACLE_SERVICE_NAME": ORACLE_SERVICE_NAME,
        }
        cleanup.callback(_restore_environment, {key: os.environ.get(key) for key in values})
        os.environ.update(values)
        logger.info("Owned Oracle container=%s image=%s", container.get_wrapped_container().id, ORACLE_IMAGE)
        yield OracleInstance(container, admin, ingestion)


@dataclass
class OracleSource:
    schema: str
    baseline: SqlSourceBaseline
    admin_engine: Engine = field(repr=False)
    _closed: bool = field(default=False, init=False, repr=False)

    def require_active(self) -> None:
        if self._closed:
            raise ValueError("Oracle source has already been closed")

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


def _grant_select(engine: Engine, schema: str, name: str, user: str) -> None:
    _execute(engine, f"GRANT SELECT ON {schema}.{name} TO {user}")


def _seed_source(source: OracleSource, user: str) -> None:
    with source.admin_engine.begin() as connection:
        source.baseline.metadata.create_all(connection, checkfirst=False)
        for seed in source.baseline.seeds:
            table = source.baseline.metadata.tables[f"{source.schema}.{seed.table_name}"]
            connection.execute(table.insert(), seed.rows)
        for statement in source.baseline.ddl:
            connection.execute(text(statement))
    for seed in source.baseline.seeds:
        _grant_select(source.admin_engine, source.schema, seed.table_name, user)
    _grant_select(source.admin_engine, source.schema, "customer_txn_summary", user)
    _execute(source.admin_engine, f"GRANT EXECUTE ON {source.schema}.sp_active_customer_count TO {user}")
    _execute(source.admin_engine, f"GRANT EXECUTE ON {source.schema}.sp_update_customer_status TO {user}")


@contextmanager
def fresh_oracle_source(admin_engine: Engine) -> Iterator[OracleSource]:
    """Create one fresh Oracle user as a schema; attempt every cleanup even on partial setup failure."""
    user = admin_engine.get_execution_options()[INGEST_USER_OPTION]
    schema_password = secrets.token_urlsafe(32)
    mask_secrets(schema_password)
    # Lowercase so the connector's default identifier normalisation returns it unchanged.
    schema = f"e2eoracle{uuid.uuid4().hex}"
    source = OracleSource(schema, build_oracle_baseline(schema), admin_engine)
    try:
        with ExitStack() as cleanup:
            _execute(admin_engine, f'CREATE USER {schema} IDENTIFIED BY "{schema_password}"')
            cleanup.callback(_execute, admin_engine, f"DROP USER {schema} CASCADE")
            _execute(admin_engine, f"ALTER USER {schema} QUOTA UNLIMITED ON USERS")
            _seed_source(source, user)
            logger.info("Owned Oracle schema=%s", schema)
            yield source
    finally:
        source._closed = True
