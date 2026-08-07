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
Prefect integration test fixtures
"""

import time
from collections.abc import Generator

import pytest
import requests
from testcontainers.core.container import DockerContainer

from _openmetadata_testutils.ometa import OM_JWT

# Measured cold-boot time for prefecthq/prefect:3-latest is ~14s. The repo's shared
# integration conftest forces testcontainers' own default wait timeout down to 10s
# (tuned for fast DB containers), which isn't enough here, so this waits on its own
# timeout instead of testcontainers' (now-deprecated) wait_container_is_ready decorator.
_HEALTHCHECK_TIMEOUT = 60


class _PrefectContainer(DockerContainer):
    """No official testcontainers module for Prefect exists (checked upstream:
    none in testcontainers-python core or community modules), so this wraps
    DockerContainer directly, same as this repo's other custom containers."""

    def __init__(self):
        super().__init__("prefecthq/prefect:3-latest")
        self.with_exposed_ports(4200)
        self.with_command(["prefect", "server", "start", "--host", "0.0.0.0"])

    def start(self) -> "_PrefectContainer":
        super().start()
        self._wait_healthy()
        return self

    def _wait_healthy(self) -> None:
        deadline = time.monotonic() + _HEALTHCHECK_TIMEOUT
        last_error: Exception = TimeoutError("no attempt made")
        while time.monotonic() < deadline:
            try:
                requests.get(f"{self.api_url}/health", timeout=2).raise_for_status()
            except requests.exceptions.RequestException as e:
                last_error = e
                time.sleep(1)
            else:
                return
        raise TimeoutError(f"Prefect server not healthy after {_HEALTHCHECK_TIMEOUT}s") from last_error

    @property
    def api_url(self) -> str:
        host = self.get_container_host_ip()
        port = self.get_exposed_port(4200)
        return f"http://{host}:{port}/api"


@pytest.fixture(scope="module")
def prefect_server() -> Generator[str, None, None]:
    """
    Start a Prefect server in Docker for integration testing.

    Yields the Prefect API URL.
    """
    with _PrefectContainer() as container:
        yield container.api_url


@pytest.fixture(scope="module")
def om_config(prefect_server: str) -> dict:
    """
    OpenMetadata workflow configuration for Prefect connector.
    """
    return {
        "source": {
            "type": "prefect",
            "serviceName": "prefect_integration_test",
            "serviceConnection": {
                "config": {
                    "type": "Prefect",
                    "hostPort": prefect_server,
                    "authType": {"authString": ""},  # self-hosted, no auth enabled
                    "numberOfStatus": 10,
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "PipelineMetadata",
                    # Required for tag-based lineage: _resolve_table_fqn only searches
                    # services listed here (metadata.py's get_db_service_names()).
                    "lineageInformation": {"dbServiceNames": ["test-service-prefect-lineage"]},
                }
            },
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "authProvider": "openmetadata",
                "securityConfig": {"jwtToken": OM_JWT},
            }
        },
    }
