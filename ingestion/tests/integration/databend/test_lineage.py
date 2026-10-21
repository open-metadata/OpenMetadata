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
Databend lineage integration tests.

Reading system_history needs a Databend Enterprise license. When QUERY_DATABEND_ENTERPRISE_LICENSE
is set it is passed to the container; the tests are skipped if Databend rejects the license.
"""

import copy
import os
import uuid

import pytest
from sqlalchemy import create_engine, text
from tenacity import retry, stop_after_delay, wait_fixed
from testcontainers.core.container import DockerContainer

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.databendConnection import (
    DatabendConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseLineageConfigType,
)
from metadata.ingestion.source.database.databend.lineage import LICENSE_ERROR_CODES
from metadata.workflow.metadata import MetadataWorkflow

from .conftest import DATABEND_HTTP_PORT, DATABEND_IMAGE, DATABEND_PASSWORD, DATABEND_USERNAME  # noqa: TID252

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

FIXTURE_SQL = [
    f"CREATE USER {DATABEND_USERNAME} IDENTIFIED BY '{DATABEND_PASSWORD}'",
    f"GRANT SELECT ON *.* TO {DATABEND_USERNAME}",
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

EXPECTED_EDGES = {
    ("lineage_demo.orders", "lineage_demo.customer_sales"),
    ("lineage_demo.customers", "mart.customer_revenue"),
    ("lineage_demo.customer_sales", "mart.customer_revenue"),
    ("mart.customer_revenue", "mart.v_revenue"),
    ("lineage_demo.customers", "mart.v_replaced"),
    ("lineage_demo.customers", "mart.v_refiltered"),
}


def _engine(container: DockerContainer):
    host = f"{container.get_container_host_ip()}:{container.get_exposed_port(DATABEND_HTTP_PORT)}"
    return create_engine(f"databend://root:@{host}/default?sslmode=disable")


@retry(wait=wait_fixed(2), stop=stop_after_delay(300), reraise=True)
def _wait_until_ready(container: DockerContainer) -> None:
    engine = _engine(container)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    finally:
        engine.dispose()


@retry(wait=wait_fixed(2), stop=stop_after_delay(60), reraise=True)
def _skip_without_license(container: DockerContainer) -> None:
    """
    Skip instead of failing when the license is rejected, so a license problem does not break
    unrelated PRs. Any other error is retried and then fails the tests.
    """
    engine = _engine(container)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT count(*) FROM system_history.lineage_history"))
    except Exception as exc:
        if any(code in str(exc) for code in LICENSE_ERROR_CODES):
            pytest.skip(
                f"Databend {DATABEND_IMAGE} rejected the Enterprise license; set {LICENSE_ENV} or upgrade "
                f"DATABEND_IMAGE in conftest.py. Error: {exc}"
            )
        raise
    finally:
        engine.dispose()


@retry(wait=wait_fixed(3), stop=stop_after_delay(LINEAGE_TIMEOUT), reraise=True)
def _wait_for_lineage(container: DockerContainer, expected: set[tuple[str, str]] = EXPECTED_EDGES) -> None:
    """History tables are flushed asynchronously, so lineage lands some seconds after the queries."""
    engine = _engine(container)
    try:
        with engine.connect() as connection:
            rows = connection.execute(
                text(
                    "SELECT source_database, source_name, target_database, target_name "
                    "FROM system_history.lineage_history"
                )
            ).fetchall()
    finally:
        engine.dispose()
    recorded = {(f"{row[0]}.{row[1]}", f"{row[2]}.{row[3]}") for row in rows}
    assert recorded >= expected, f"Lineage not recorded yet: {expected - recorded}"


@pytest.fixture(scope="module")
def databend_lineage_container(tmp_path_factory):
    config_file = tmp_path_factory.mktemp("databend") / "query.toml"
    config_file.write_text(QUERY_CONFIG)
    container = (
        DockerContainer(DATABEND_IMAGE)
        .with_exposed_ports(DATABEND_HTTP_PORT)
        .with_env("QUERY_CONFIG_FILE", "/etc/databend/lineage.toml")
        .with_volume_mapping(str(config_file), "/etc/databend/lineage.toml", "ro")
    )
    if os.getenv(LICENSE_ENV):
        container = container.with_env(LICENSE_ENV, os.environ[LICENSE_ENV])
    with container as running_container:
        _wait_until_ready(running_container)
        _skip_without_license(running_container)
        engine = _engine(running_container)
        try:
            with engine.begin() as connection:
                for statement in FIXTURE_SQL:
                    connection.execute(text(statement))
        finally:
            engine.dispose()
        _wait_for_lineage(running_container)
        yield running_container


@pytest.fixture(scope="module")
def create_service_request(databend_lineage_container):
    return CreateDatabaseServiceRequest.model_validate(
        {
            "name": f"docker_test_databend_lineage_{uuid.uuid4().hex[:8]}",
            "serviceType": DatabaseServiceType.Databend,
            "connection": DatabaseConnection(
                config=DatabendConnection.model_validate(
                    {
                        "username": DATABEND_USERNAME,
                        "password": DATABEND_PASSWORD,
                        "hostPort": (
                            f"{databend_lineage_container.get_container_host_ip()}:"
                            f"{databend_lineage_container.get_exposed_port(DATABEND_HTTP_PORT)}"
                        ),
                        "connectionOptions": {"sslmode": "disable"},
                    }
                )
            ),
        }
    )


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
def ingest_lineage(patch_passwords_for_db_services, run_workflow, ingestion_config, lineage_config):
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(MetadataWorkflow, lineage_config)


def _upstream_edges(metadata, table_fqn: str) -> dict[str, dict]:
    lineage = metadata.get_lineage_by_name(Table, table_fqn, up_depth=1, down_depth=0)
    nodes = {node["id"]: node["fullyQualifiedName"] for node in lineage.get("nodes", [])}
    nodes[lineage["entity"]["id"]] = lineage["entity"]["fullyQualifiedName"]
    return {nodes[edge["fromEntity"]]: edge.get("lineageDetails", {}) for edge in lineage.get("upstreamEdges", [])}


def test_table_and_column_lineage_from_databend(ingest_lineage, db_service, metadata):
    prefix = f"{db_service.fullyQualifiedName.root}.default"

    revenue = _upstream_edges(metadata, f"{prefix}.mart.customer_revenue")
    assert set(revenue) == {f"{prefix}.lineage_demo.customers", f"{prefix}.lineage_demo.customer_sales"}
    details = revenue[f"{prefix}.lineage_demo.customer_sales"]
    assert details["source"] == "QueryLineage"
    assert {(column["toColumn"], tuple(column["fromColumns"])) for column in details.get("columnsLineage", [])} == {
        (f"{prefix}.mart.customer_revenue.total_amount", (f"{prefix}.lineage_demo.customer_sales.total_amount",)),
    }

    sales = _upstream_edges(metadata, f"{prefix}.lineage_demo.customer_sales")
    assert set(sales) == {f"{prefix}.lineage_demo.orders"}


def test_view_lineage_from_databend(ingest_lineage, db_service, metadata):
    prefix = f"{db_service.fullyQualifiedName.root}.default"

    view = _upstream_edges(metadata, f"{prefix}.mart.v_revenue")
    assert set(view) == {f"{prefix}.mart.customer_revenue"}
    assert view[f"{prefix}.mart.customer_revenue"]["source"] == "ViewLineage"


def test_replaced_view_without_upstreams_loses_its_view_lineage(
    ingest_lineage, databend_lineage_container, run_workflow, lineage_config, db_service, metadata
):
    view_fqn = f"{db_service.fullyQualifiedName.root}.default.mart.v_replaced"
    assert set(_upstream_edges(metadata, view_fqn)) == {
        f"{db_service.fullyQualifiedName.root}.default.lineage_demo.customers"
    }

    # The new definition reads no table, so Databend records no lineage for it and keeps the old record.
    engine = _engine(databend_lineage_container)
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE OR REPLACE VIEW mart.v_replaced AS SELECT 1 AS customer_id"))
    finally:
        engine.dispose()

    run_workflow(MetadataWorkflow, lineage_config)
    assert _upstream_edges(metadata, view_fqn) == {}


def test_replaced_view_with_only_filtered_upstreams_loses_its_view_lineage(
    ingest_lineage, databend_lineage_container, run_workflow, lineage_config, db_service, metadata
):
    prefix = f"{db_service.fullyQualifiedName.root}.default"
    view_fqn = f"{prefix}.mart.v_refiltered"
    assert set(_upstream_edges(metadata, view_fqn)) == {f"{prefix}.lineage_demo.customers"}

    engine = _engine(databend_lineage_container)
    try:
        with engine.begin() as connection:
            connection.execute(
                text("CREATE OR REPLACE VIEW mart.v_refiltered AS SELECT order_id FROM lineage_demo.orders")
            )
    finally:
        engine.dispose()
    # The new definition does have a current record; wait for it so the run sees it and filters it out.
    _wait_for_lineage(databend_lineage_container, {("lineage_demo.orders", "mart.v_refiltered")})

    filtered_config = copy.deepcopy(lineage_config)
    filtered_config["source"]["sourceConfig"]["config"]["tableFilterPattern"] = {"excludes": ["orders"]}
    run_workflow(MetadataWorkflow, filtered_config)
    assert _upstream_edges(metadata, view_fqn) == {}
