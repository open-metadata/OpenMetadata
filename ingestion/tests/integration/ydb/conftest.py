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

"""
Fixtures for YDB integration tests.

Spins up a single-node ``ydbplatform/local-ydb`` container with in-memory
pdisks (no persistence between runs) and seeds it with a small mixed
schema covering both root-level and nested directory paths. The seed data
is shared across all tests in the module.
"""

import os
import socket
import textwrap
import time
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.schema import DDL

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.ydbConnection import (
    YDBConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)

YDB_IMAGE = os.environ.get("YDB_IMAGE", "ydbplatform/local-ydb:26.1.1")
YDB_GRPC_PORT = 2136


def _pick_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def ydb_container():
    # testcontainers lives in the `[test]` extras group — import lazily so
    # the conftest still loads (and unrelated test discovery still works)
    # in environments where the extras are not installed.
    from testcontainers.core.container import DockerContainer

    # YDB's discovery service advertises an endpoint built from
    # ``$HOSTNAME:$GRPC_PORT``. From outside the container, the
    # auto-assigned hostname isn't resolvable and the in-container port
    # isn't mapped 1:1 — so we have to do three things together:
    #   - pin a host port (so we can predict the address),
    #   - use the same number as $GRPC_PORT (so YDB listens and
    #     advertises on the same port the host sees),
    #   - override $HOSTNAME to ``localhost`` so the advertised
    #     endpoint is reachable from the host.
    # The ``docker/development/docker-compose.yml`` setup uses the
    # exact same trick (HOSTNAME=localhost, 2136:2136).
    port = _pick_free_port()

    class _YdbContainer(DockerContainer):
        def __init__(self, image: str = YDB_IMAGE, **kwargs):
            super().__init__(image, **kwargs)
            self.port = port
            self.with_exposed_ports(port)
            self.with_bind_ports(port, port)
            self.with_env("GRPC_PORT", str(port))
            self.with_env("YDB_USE_IN_MEMORY_PDISKS", "true")
            # YDB's discovery service builds its advertised endpoint from
            # the container's own hostname. Override the Docker-level
            # hostname (the env var is too late — Docker sets the actual
            # hostname at create time) so the advertised endpoint is
            # ``localhost:<port>``, which the bind-port mapping makes
            # reachable from the test process.
            self.with_kwargs(hostname="localhost")

        @property
        def database(self) -> str:
            return "/local"

        def grpc_url(self) -> str:
            return f"yql+ydb://localhost:{self.port}{self.database}"

    def _wait_ready(c: "_YdbContainer", timeout_s: int = 120) -> None:
        """Poll until YDB can actually create+drop a scheme object.
        Discovery responds before storage pools finish initialising, so
        a plain ``SELECT 1`` is an insufficient readiness signal — the
        first ``CREATE TABLE`` would then fail with ``database doesn't
        have storage pools``."""
        probe = "`__ydb_readiness_probe`"
        deadline = time.time() + timeout_s
        last_err: Exception | None = None
        while time.time() < deadline:
            try:
                engine = create_engine(c.grpc_url())
                with engine.connect() as conn:
                    conn.execute(DDL(f"CREATE TABLE {probe} (k Int64, PRIMARY KEY (k))"))
                    conn.execute(DDL(f"DROP TABLE {probe}"))
                    conn.commit()
                engine.dispose()
            except Exception as exc:
                last_err = exc
                time.sleep(2)
            else:
                return
        raise TimeoutError(f"YDB did not become writable in {timeout_s}s — last error: {last_err}")

    container = _YdbContainer()
    with container as started:
        _wait_ready(started)
        yield started


@pytest.fixture(scope="module")
def unmask_password():
    """YDB integration tests use anonymous (``NoCredentials``) auth, so the
    base ``unmask_password`` fixture — which assumes ``authType.password``
    exists — would fail. Return identity instead."""

    def identity(service):
        return service

    return identity


@pytest.fixture(scope="module")
def create_service_request(ydb_container):
    host_port = f"{ydb_container.get_container_host_ip()}:{ydb_container.get_exposed_port(ydb_container.port)}"
    return CreateDatabaseServiceRequest(
        name=f"docker_test_ydb_{uuid.uuid4().hex[:8]}",
        serviceType=DatabaseServiceType.YDB,
        connection=DatabaseConnection(
            config=YDBConnection(
                hostPort=host_port,
                database=ydb_container.database,
                authType={},
            )
        ),
    )


@pytest.fixture(scope="module")
def create_test_data(ydb_container):
    """Seed the container with tables and views exercising the directory
    semantics our connector flattens into (schema, table) pairs."""
    engine = create_engine(ydb_container.grpc_url())

    setup = [
        # Root-level table — exercises ROOT_SCHEMA fallback.
        textwrap.dedent(
            """
            CREATE TABLE `orders` (
                order_id Int64,
                amount   Double,
                PRIMARY KEY (order_id)
            )
            """
        ),
        "INSERT INTO `orders` (order_id, amount) VALUES (1, 100.0), (2, 200.0), (3, 300.0)",
        # One-level nested table — `raw/events` ⇒ schema=raw, table=events.
        textwrap.dedent(
            """
            CREATE TABLE `raw/events` (
                event_id Utf8,
                user_id  Utf8,
                ts       Datetime,
                PRIMARY KEY (event_id)
            )
            """
        ),
        textwrap.dedent(
            """
            INSERT INTO `raw/events` (event_id, user_id, ts) VALUES
                ('e1', 'u1', Datetime('2024-01-01T10:00:00Z')),
                ('e2', 'u2', Datetime('2024-01-02T11:00:00Z')),
                ('e3', 'u1', Datetime('2024-01-03T12:00:00Z'))
            """
        ),
        # Nested staging view referencing the raw table — verifies that the
        # lineage pipeline can resolve `raw/events` after our DDL rewrite.
        "DROP VIEW IF EXISTS `staging/events`",
        textwrap.dedent(
            """
            CREATE VIEW `staging/events` WITH (security_invoker = TRUE) AS
                SELECT event_id, user_id, ts FROM `raw/events`
            """
        ),
        # Two-level nested view — exercises the multi-segment schema name
        # (schema = "marts/analytics").
        "DROP VIEW IF EXISTS `marts/analytics/events_by_user`",
        textwrap.dedent(
            """
            CREATE VIEW `marts/analytics/events_by_user` WITH (security_invoker = TRUE) AS
                SELECT user_id, COUNT(*) AS event_count
                FROM `staging/events`
                GROUP BY user_id
            """
        ),
    ]
    with engine.connect() as conn:
        for statement in setup:
            stmt = statement.strip()
            if not stmt:
                continue
            # YDB rejects scheme ops inside a transaction. SQLAlchemy
            # routes DDL constructs through ``cursor.execute_scheme()``
            # (autocommit) only when ``isddl=True`` on the execution
            # context — raw ``text()`` does NOT set that flag, so we
            # wrap CREATE/DROP statements in ``sa.schema.DDL(...)``.
            leading = stmt.lower().split(None, 1)[0]
            if leading in ("create", "drop", "alter"):
                conn.execute(DDL(stmt))
            else:
                conn.execute(text(stmt))
            conn.commit()

    yield
