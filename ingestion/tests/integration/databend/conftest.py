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
"""Databend integration-test fixtures."""

import os
import uuid

import pytest
from sqlalchemy import create_engine, text
from tenacity import retry, stop_after_delay, wait_fixed
from testcontainers.core.container import DockerContainer

from _openmetadata_testutils.helpers.docker import try_bind
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.databendConnection import (
    DatabendConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)

DATABEND_IMAGE = "datafuselabs/databend:v1.2.945-nightly"
DATABEND_HTTP_PORT = 8000
DATABEND_USERNAME = "databend"
DATABEND_PASSWORD = "databend"
DATABEND_READY_TIMEOUT = int(os.getenv("DATABEND_READY_TIMEOUT", "300"))


def _connection_url(container: DockerContainer) -> str:
    return (
        f"databend://{DATABEND_USERNAME}:{DATABEND_PASSWORD}"
        f"@{container.get_container_host_ip()}:{container.get_exposed_port(DATABEND_HTTP_PORT)}"
        "/default?sslmode=disable"
    )


@retry(wait=wait_fixed(2), stop=stop_after_delay(DATABEND_READY_TIMEOUT), reraise=True)
def _connect_until_ready(container: DockerContainer) -> None:
    engine = create_engine(_connection_url(container))
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    finally:
        engine.dispose()


def _container_diagnostics(container: DockerContainer) -> str:
    """Collect the server-side logs a bare connection error never shows."""
    try:
        wrapped = container.get_wrapped_container()
        docker_logs = wrapped.logs(tail=50).decode("utf-8", errors="replace")
        # bootstrap.sh runs meta and query as background processes and keeps the
        # container alive by tailing their logs, so a dead query process still
        # looks "Up" from the outside. Its own log is the only real evidence.
        exit_code, query_log = wrapped.exec_run(["tail", "-n", "50", "/tmp/std-query.log"])
        query_tail = query_log.decode("utf-8", errors="replace") if exit_code == 0 else "<unavailable>"
    except Exception as exc:  # pylint: disable=broad-except
        return f"<failed to collect container diagnostics: {exc}>"
    return f"container status={wrapped.status}\ndocker logs:\n{docker_logs}\nstd-query.log:\n{query_tail}"


def _wait_until_ready(container: DockerContainer) -> None:
    try:
        _connect_until_ready(container)
    except Exception as exc:
        raise RuntimeError(
            f"Databend container did not become ready within {DATABEND_READY_TIMEOUT}s: {exc}\n"
            f"{_container_diagnostics(container)}"
        ) from exc


def _prepare_test_data(container: DockerContainer) -> None:
    engine = create_engine(_connection_url(container))
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE DATABASE IF NOT EXISTS analytics"))
            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS analytics.customers (
                        id INT,
                        name VARCHAR,
                        email VARCHAR
                    )
                    """
                )
            )
            connection.execute(
                text(
                    """
                    INSERT INTO analytics.customers
                    SELECT
                        number::INT + 1,
                        concat('Customer ', to_string(number + 1)),
                        concat('customer', to_string(number + 1), '@example.com')
                    FROM numbers(100)
                    """
                )
            )
            connection.execute(
                text(
                    """
                    CREATE VIEW analytics.active_customers AS
                    SELECT id, name, email FROM analytics.customers WHERE id > 0
                    """
                )
            )
    finally:
        engine.dispose()


@pytest.fixture(scope="package")
def databend_container():
    container = (
        DockerContainer(DATABEND_IMAGE)
        .with_exposed_ports(DATABEND_HTTP_PORT)
        .with_env("QUERY_DEFAULT_USER", DATABEND_USERNAME)
        .with_env("QUERY_DEFAULT_PASSWORD", DATABEND_PASSWORD)
        .with_env("QUERY_HTTP_HANDLER_HOST", "0.0.0.0")
    )

    context = container if os.getenv("CI") else try_bind(container, DATABEND_HTTP_PORT, None)
    with context as running_container:
        _wait_until_ready(running_container)
        _prepare_test_data(running_container)
        yield running_container


@pytest.fixture(scope="package")
def databend_connection(databend_container):
    return DatabendConnection.model_validate(
        {
            "username": DATABEND_USERNAME,
            "password": DATABEND_PASSWORD,
            "hostPort": (
                f"{databend_container.get_container_host_ip()}:"
                f"{databend_container.get_exposed_port(DATABEND_HTTP_PORT)}"
            ),
            "database": "default",
            "databaseSchema": "analytics",
            "connectionOptions": {"sslmode": "disable"},
        }
    )


@pytest.fixture(scope="module")
def create_service_request(databend_connection):
    return CreateDatabaseServiceRequest.model_validate(
        {
            "name": f"docker_test_databend_{uuid.uuid4().hex[:8]}",
            "serviceType": DatabaseServiceType.Databend,
            "connection": DatabaseConnection(config=databend_connection),
        }
    )
