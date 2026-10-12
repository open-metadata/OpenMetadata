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
Airflow container fixtures.

Runs Airflow with the OpenMetadata lineage provider in a testcontainer, so the suite owns
its own DAGs and connections instead of depending on the compose ingestion service.
"""

import json
import shutil
import tempfile
import time
from pathlib import Path

import pytest
import requests
from testcontainers.core.container import DockerContainer
from testcontainers.core.docker_client import DockerClient

AIRFLOW_BASE_IMAGE = "apache/airflow:3.3.1-python3.10"
AIRFLOW_TEST_IMAGE = "om-airflow-lineage-test:local"

# Fixed network name declared by docker/development/docker-compose.yml, so the container
# resolves `openmetadata-server` exactly as the OM connection below expects.
OM_NETWORK = "ometa_network"
OM_SERVER_HOST = "openmetadata-server"
OM_SERVER_PORT = 8585

AIRFLOW_ADMIN = "admin"
OM_CONNECTION_ID = "openmetadata_conn_id"
OM_JWT = (
    "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9"
    ".eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0"
    "NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0"
    "mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv"
    "_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W"
    "8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U4"
    "93VanKpUAfzIiOiIbhg"
)

_DOCKERFILE = "tests/integration/airflow/Dockerfile"

# A list, and via bash: the base image's entrypoint prefixes anything it does not
# recognise with `airflow`, and a single string would be re-split by the runtime.
_START_AIRFLOW = ["bash", "/opt/airflow/start-test-airflow.sh"]


def _ingestion_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _auth_token(host: str, port: str) -> str | None:
    """Airflow JWT for the admin user, or None while the API is still starting."""
    try:
        response = requests.post(
            f"http://{host}:{port}/auth/token",
            json={"username": AIRFLOW_ADMIN, "password": AIRFLOW_ADMIN},
            timeout=10,
        )
    except requests.RequestException:
        return None
    return response.json().get("access_token") if response.status_code in (200, 201) else None


def _wait_for_airflow_api(container, timeout: int = 420) -> None:
    """Block until the Airflow API issues tokens. Raises TimeoutError otherwise."""
    host = container.get_container_host_ip()
    port = container.get_exposed_port(8080)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if _auth_token(host, port):
            return
        time.sleep(5)

    stdout, stderr = container.get_logs()
    raise TimeoutError(
        f"Airflow API did not become ready within {timeout}s.\n"
        f"--- container stdout ---\n{stdout.decode(errors='replace')[-4000:]}\n"
        f"--- container stderr ---\n{stderr.decode(errors='replace')[-4000:]}"
    )


@pytest.fixture(scope="session")
def airflow_image():
    """Build the Airflow image carrying the working tree's lineage provider."""
    DockerClient().client.images.build(
        path=str(_ingestion_root()),
        dockerfile=_DOCKERFILE,
        tag=AIRFLOW_TEST_IMAGE,
        rm=True,
    )
    return AIRFLOW_TEST_IMAGE


@pytest.fixture(scope="module")
def airflow_dag_dir():
    """Host directory mounted as the Airflow DAG folder; tests write their DAGs here."""
    # Not tmp_path_factory: its 0700 dirs are unreadable to the container's airflow user
    # on Linux, and Docker Desktop's uid translation hides that everywhere but CI.
    dag_dir = Path(tempfile.mkdtemp(prefix="airflow_dags_"))
    dag_dir.chmod(0o755)

    yield dag_dir

    shutil.rmtree(dag_dir, ignore_errors=True)


@pytest.fixture(scope="module")
def airflow_container(airflow_image, airflow_dag_dir):
    """Airflow reachable on the host, joined to the OpenMetadata compose network."""
    connection = json.dumps(
        {
            "conn_type": "openmetadata",
            "host": OM_SERVER_HOST,
            "schema": "http",
            "port": OM_SERVER_PORT,
            "password": OM_JWT,
        }
    )

    container = (
        DockerContainer(AIRFLOW_TEST_IMAGE)
        .with_kwargs(network=OM_NETWORK)
        .with_exposed_ports(8080)
        .with_volume_mapping(str(airflow_dag_dir), "/opt/airflow/dags", "ro")
        .with_env("AIRFLOW__CORE__EXECUTOR", "LocalExecutor")
        .with_env("AIRFLOW__CORE__LOAD_EXAMPLES", "False")
        .with_env("AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_USERS", f"{AIRFLOW_ADMIN}:admin")
        .with_env(
            "AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_PASSWORDS_FILE",
            "/opt/airflow/simple_auth_manager_passwords.json",
        )
        # Default is 300s; a DAG written after start would otherwise take 5 minutes to appear.
        .with_env("AIRFLOW__DAG_PROCESSOR__REFRESH_INTERVAL", "5")
        .with_env(f"AIRFLOW_CONN_{OM_CONNECTION_ID.upper()}", connection)
        .with_command(_START_AIRFLOW)
    )

    with container:
        _wait_for_airflow_api(container)
        yield container


@pytest.fixture(scope="module")
def airflow_api(airflow_container):
    """Base URL of the Airflow REST API as seen from the host."""
    host = airflow_container.get_container_host_ip()
    port = airflow_container.get_exposed_port(8080)
    return f"http://{host}:{port}/api/v2"


@pytest.fixture(scope="module")
def airflow_headers(airflow_container):
    """Authorization headers carrying a freshly minted Airflow JWT."""
    token = _auth_token(
        airflow_container.get_container_host_ip(),
        airflow_container.get_exposed_port(8080),
    )
    assert token, "Airflow refused to issue a token"

    return {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
