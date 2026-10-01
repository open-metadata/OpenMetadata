import time
import uuid

import pytest
import requests
from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_utils import wait_for_logs

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.dremio.softwareAuth import (
    DremioSoftwareAuthentication,
)
from metadata.generated.schema.entity.services.connections.database.dremioConnection import (
    DremioConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)

DREMIO_IMAGE = "dremio/dremio-oss:26.0.5"
DREMIO_REST_PORT = 9047
# The connector reaches Arrow Flight on this port of the host in the hostPort URL.
DREMIO_FLIGHT_PORT = 32010
DREMIO_USER = "admin"
DREMIO_PASSWORD = "Admin-1234-test"
NAS_PATH = "/var/lib/dremio/lake"
JOB_TIMEOUT_SECONDS = 180


class DremioRest:
    """The few calls of Dremio's REST API that the fixtures need."""

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.headers = {"Authorization": "_dremionull"}

    def call(self, method: str, path: str, body: dict | None = None) -> dict:
        response = requests.request(method, f"{self.base_url}{path}", json=body, headers=self.headers, timeout=60)
        response.raise_for_status()
        return response.json() if response.content else {}

    def create_first_user(self) -> None:
        self.call(
            "PUT",
            "/apiv2/bootstrap/firstuser",
            {
                "userName": DREMIO_USER,
                "firstName": "Test",
                "lastName": "User",
                "email": "test@example.com",
                "createdAt": int(time.time() * 1000),
                "password": DREMIO_PASSWORD,
            },
        )
        token = self.call("POST", "/apiv2/login", {"userName": DREMIO_USER, "password": DREMIO_PASSWORD})["token"]
        self.headers = {"Authorization": f"_dremio{token}"}

    def run_sql(self, sql: str) -> None:
        job_id = self.call("POST", "/api/v3/sql", {"sql": sql})["id"]
        deadline = time.time() + JOB_TIMEOUT_SECONDS
        while time.time() < deadline:
            job = self.call("GET", f"/api/v3/job/{job_id}")
            if job["jobState"] == "COMPLETED":
                return
            if job["jobState"] in {"FAILED", "CANCELED"}:
                raise RuntimeError(f"Dremio job failed: {sql}\n{job.get('errorMessage')}")
            time.sleep(1)
        raise TimeoutError(f"Dremio job did not finish: {sql}")


@pytest.fixture(scope="module")
def dremio_container():
    container = (
        DockerContainer(DREMIO_IMAGE)
        .with_exposed_ports(DREMIO_REST_PORT)
        .with_bind_ports(DREMIO_FLIGHT_PORT, DREMIO_FLIGHT_PORT)
    )
    with container:
        wait_for_logs(container, r"Dremio Daemon Started as master", timeout=600)
        yield container


@pytest.fixture(scope="module")
def dremio_rest(dremio_container):
    host = dremio_container.get_container_host_ip()
    rest = DremioRest(f"http://{host}:{dremio_container.get_exposed_port(DREMIO_REST_PORT)}")
    deadline = time.time() + 300
    while time.time() < deadline:
        try:
            if requests.get(f"{rest.base_url}/apiv2/server_status", timeout=5).json() == "OK":
                break
        except requests.RequestException:
            pass
        time.sleep(3)
    else:
        raise TimeoutError("Dremio did not become ready")
    rest.create_first_user()
    return rest


@pytest.fixture(scope="module")
def dremio_data(dremio_container, dremio_rest):
    """A NAS source with two tables, and a space with a view that joins them."""
    dremio_container.get_wrapped_container().exec_run(["mkdir", "-p", NAS_PATH], user="dremio")
    dremio_rest.call(
        "POST",
        "/api/v3/catalog",
        {"entityType": "source", "name": "lake", "type": "NAS", "config": {"path": NAS_PATH}},
    )
    dremio_rest.run_sql(
        "CREATE TABLE lake.sales.customers AS "
        "SELECT 1 AS id, 'Ada' AS name, 'FR' AS country UNION ALL SELECT 2, 'Bob', 'CH'"
    )
    dremio_rest.run_sql(
        "CREATE TABLE lake.sales.orders AS SELECT 10 AS order_id, 1 AS customer_id, CAST(12.5 AS DOUBLE) AS amount"
    )
    dremio_rest.call("POST", "/api/v3/catalog", {"entityType": "space", "name": "reporting"})
    dremio_rest.run_sql(
        "CREATE VIEW reporting.customer_totals AS "
        "SELECT c.name, c.country, SUM(o.amount) AS total "
        "FROM lake.sales.customers c JOIN lake.sales.orders o ON o.customer_id = c.id "
        "GROUP BY c.name, c.country"
    )
    # A view built on a view of the same space, named by its two-part path.
    dremio_rest.run_sql(
        "CREATE VIEW reporting.top_customers AS SELECT name, total FROM reporting.customer_totals WHERE total > 10"
    )


@pytest.fixture(scope="module")
def create_service_request(dremio_container, dremio_rest, dremio_data):
    host = dremio_container.get_container_host_ip()
    return CreateDatabaseServiceRequest(
        name=f"docker_test_dremio_{uuid.uuid4().hex[:8]}",
        serviceType=DatabaseServiceType.Dremio,
        connection=DatabaseConnection(
            config=DremioConnection(
                authType=DremioSoftwareAuthentication(
                    hostPort=f"http://{host}:{dremio_container.get_exposed_port(DREMIO_REST_PORT)}",
                    username=DREMIO_USER,
                    password=DREMIO_PASSWORD,
                )
            )
        ),
    )
