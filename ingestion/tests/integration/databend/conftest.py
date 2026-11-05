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
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import DatabaseLineageConfigType
from metadata.ingestion.source.database.databend.lineage import LICENSE_ERROR_CODES
from metadata.workflow.metadata import MetadataWorkflow

# Lineage requires v1.2.935+; retain an explicit tag for reproducible startup.
DATABEND_IMAGE = (
    "datafuselabs/databend:v1.2.945-nightly@sha256:d8a1bbe75dd2439b92915d61cbc6180972f42476444e498cad4589ab9835e0f8"
)
DATABEND_HTTP_PORT = 8000
DATABEND_USERNAME = "databend"
DATABEND_PASSWORD = "databend"
DATABEND_READY_TIMEOUT = int(os.getenv("DATABEND_READY_TIMEOUT", "300"))

LICENSE_ENV = "QUERY_DATABEND_ENTERPRISE_LICENSE"
LINEAGE_TIMEOUT = int(os.getenv("DATABEND_LINEAGE_TIMEOUT", "180"))

QUERY_CONFIG = """
[query]
http_handler_host = "0.0.0.0"
http_handler_port = 8000
tenant_id = "default"
cluster_id = "default"

[[query.users]]
name = "root"
auth_type = "no_password"

[lineage]
on = true

[log]
[log.history]
on = true
interval = 2

[meta]
endpoints = ["0.0.0.0:9191"]
username = "root"
password = "root"

[storage]
type = "fs"

[storage.fs]
data_path = "/var/lib/databend/query"
"""

LINEAGE_SQL = [
    "CREATE DATABASE lineage_demo",
    "CREATE DATABASE mart",
    "CREATE TABLE lineage_demo.orders (order_id BIGINT, customer_id BIGINT, amount DECIMAL(12, 2))",
    "CREATE TABLE lineage_demo.customers (customer_id BIGINT, name VARCHAR, region VARCHAR)",
    "INSERT INTO lineage_demo.orders VALUES (1, 10, 120.50), (2, 10, 990.00), (3, 11, 15.00)",
    "INSERT INTO lineage_demo.customers VALUES (10, 'alice', 'EU'), (11, 'bob', 'US')",
    "CREATE TABLE lineage_demo.customer_sales AS "
    "SELECT customer_id, sum(amount) AS total_amount FROM lineage_demo.orders GROUP BY customer_id",
    "CREATE TABLE mart.customer_revenue (customer_id BIGINT, name VARCHAR, total_amount DECIMAL(38, 2))",
    "INSERT INTO mart.customer_revenue SELECT c.customer_id, c.name, s.total_amount "
    "FROM lineage_demo.customers c JOIN lineage_demo.customer_sales s ON c.customer_id = s.customer_id",
    "CREATE VIEW mart.v_revenue AS SELECT customer_id, total_amount FROM mart.customer_revenue",
    "CREATE VIEW mart.v_replaced AS SELECT customer_id FROM lineage_demo.customers",
    "CREATE VIEW mart.v_refiltered AS SELECT customer_id FROM lineage_demo.customers",
]

EXPECTED_LINEAGE_EDGES = {
    ("lineage_demo.orders", "lineage_demo.customer_sales"),
    ("lineage_demo.customers", "mart.customer_revenue"),
    ("lineage_demo.customer_sales", "mart.customer_revenue"),
    ("mart.customer_revenue", "mart.v_revenue"),
    ("lineage_demo.customers", "mart.v_replaced"),
    ("lineage_demo.customers", "mart.v_refiltered"),
}


def _connection_url(container: DockerContainer) -> str:
    return (
        "databend://root:"
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
        wrapped.reload()
        docker_logs = wrapped.logs(tail=50).decode("utf-8", errors="replace")
        # The bootstrap log tailer can outlive a failed query or meta process.
        process_logs = []
        for path in ("/tmp/std-query.log", "/tmp/std-meta.log"):
            exit_code, output = wrapped.exec_run(["tail", "-n", "50", path])
            tail = output.decode("utf-8", errors="replace") if exit_code == 0 else "<unavailable>"
            process_logs.append(f"{path}:\n{tail}")
    except Exception as exc:  # pylint: disable=broad-except
        return f"<failed to collect container diagnostics: {exc}>"
    return f"container state={wrapped.attrs['State']}\ndocker logs:\n{docker_logs}\n" + "\n".join(process_logs)


def _wait_until_ready(container: DockerContainer) -> None:
    try:
        _connect_until_ready(container)
    except Exception as exc:
        raise RuntimeError(
            f"Databend container did not become ready within {DATABEND_READY_TIMEOUT}s: {exc}\n"
            f"{_container_diagnostics(container)}"
        ) from exc


def _prepare_test_data(engine) -> None:
    with engine.begin() as connection:
        connection.execute(text("CREATE DATABASE analytics"))
        connection.execute(
            text(
                """
                CREATE TABLE analytics.customers (
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


@pytest.fixture(scope="package")
def databend_container(tmp_path_factory):
    config_file = tmp_path_factory.mktemp("databend") / "query.toml"
    config_file.write_text(QUERY_CONFIG)
    container = (
        DockerContainer(DATABEND_IMAGE)
        .with_exposed_ports(DATABEND_HTTP_PORT)
        .with_env("QUERY_CONFIG_FILE", "/etc/databend/query.toml")
        .with_volume_mapping(str(config_file), "/etc/databend/query.toml", "ro")
    )
    if os.getenv(LICENSE_ENV):
        container = container.with_env(LICENSE_ENV, os.environ[LICENSE_ENV])
    with container as running_container:
        _wait_until_ready(running_container)
        engine = create_engine(_connection_url(running_container))
        try:
            with engine.begin() as connection:
                connection.execute(text(f"CREATE USER {DATABEND_USERNAME} IDENTIFIED BY '{DATABEND_PASSWORD}'"))
                connection.execute(text(f"GRANT SELECT ON *.* TO {DATABEND_USERNAME}"))
        finally:
            engine.dispose()
        yield running_container


@pytest.fixture(scope="module")
def databend_engine(databend_container):
    engine = create_engine(_connection_url(databend_container))
    try:
        _prepare_test_data(engine)
        yield engine
    finally:
        try:
            with engine.begin() as connection:
                connection.execute(text("DROP DATABASE IF EXISTS analytics"))
        finally:
            engine.dispose()


@pytest.fixture(scope="module")
def databend_connection(databend_container, databend_engine):
    return DatabendConnection.model_validate(
        {
            "username": DATABEND_USERNAME,
            "password": DATABEND_PASSWORD,
            "hostPort": (
                f"{databend_container.get_container_host_ip()}:"
                f"{databend_container.get_exposed_port(DATABEND_HTTP_PORT)}"
            ),
            "databaseSchema": "analytics",
            "connectionOptions": {"sslmode": "disable"},
        }
    )


@pytest.fixture
def databend_connection_without_history(databend_connection, databend_engine):
    username = "databend_no_history"
    with databend_engine.begin() as connection:
        connection.execute(text(f"CREATE USER {username} IDENTIFIED BY '{DATABEND_PASSWORD}'"))
        connection.execute(text(f"GRANT SELECT ON analytics.* TO {username}"))
        connection.execute(text(f"GRANT SELECT ON system.* TO {username}"))
    try:
        yield databend_connection.model_copy(update={"username": username})
    finally:
        with databend_engine.begin() as connection:
            connection.execute(text(f"DROP USER {username}"))


@pytest.fixture(scope="module")
def create_service_request(databend_connection):
    return CreateDatabaseServiceRequest.model_validate(
        {
            "name": f"docker_test_databend_{uuid.uuid4().hex[:8]}",
            "serviceType": DatabaseServiceType.Databend,
            "connection": DatabaseConnection(config=databend_connection),
        }
    )


@pytest.fixture(scope="module")
def wait_for_databend_lineage(databend_engine):
    @retry(wait=wait_fixed(3), stop=stop_after_delay(LINEAGE_TIMEOUT), reraise=True)
    def wait_for_edges(expected):
        with databend_engine.connect() as connection:
            rows = connection.execute(
                text(
                    "SELECT source_database, source_name, target_database, target_name "
                    "FROM system_history.lineage_history"
                )
            ).fetchall()
        recorded = {(f"{row[0]}.{row[1]}", f"{row[2]}.{row[3]}") for row in rows}
        assert recorded >= expected, f"Lineage not recorded yet: {expected - recorded}"

    return wait_for_edges


@pytest.fixture(scope="module")
def databend_lineage_data(databend_engine, wait_for_databend_lineage):
    @retry(wait=wait_fixed(2), stop=stop_after_delay(60), reraise=True)
    def check_license():
        try:
            with databend_engine.connect() as connection:
                connection.execute(text("SELECT count(*) FROM system_history.lineage_history"))
        except Exception as exc:
            if any(code in str(exc) for code in LICENSE_ERROR_CODES):
                pytest.skip(f"Databend {DATABEND_IMAGE} requires a valid Enterprise license; set {LICENSE_ENV}")
            raise

    check_license()
    try:
        with databend_engine.begin() as connection:
            for statement in LINEAGE_SQL:
                connection.execute(text(statement))
        wait_for_databend_lineage(EXPECTED_LINEAGE_EDGES)
        yield
    finally:
        with databend_engine.begin() as connection:
            connection.execute(text("DROP DATABASE IF EXISTS mart"))
            connection.execute(text("DROP DATABASE IF EXISTS lineage_demo"))


@pytest.fixture(scope="module")
def lineage_config(db_service, workflow_config, sink_config):
    return {
        "source": {
            "type": "databend-lineage",
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {"type": DatabaseLineageConfigType.DatabaseLineage.value, "overrideViewLineage": True}
            },
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.fixture(scope="module")
def ingest_lineage(
    databend_lineage_data, patch_passwords_for_db_services, run_workflow, ingestion_config, lineage_config
):
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(MetadataWorkflow, lineage_config)
