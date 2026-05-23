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
import os
import subprocess
import time
from typing import Generator

import pytest
import requests


@pytest.fixture(scope="module")
def prefect_server() -> Generator[str, None, None]:
    """
    Start a Prefect server in Docker for integration testing.

    Yields the Prefect API URL.
    """
    container_name = "prefect-test-server"
    port = 4200

    # Check if container already exists
    check_cmd = ["docker", "ps", "-a", "-q", "-f", f"name={container_name}"]
    existing = subprocess.run(check_cmd, capture_output=True, text=True, check=False)

    if existing.stdout.strip():
        # Remove existing container
        subprocess.run(["docker", "rm", "-f", container_name], check=False)

    # Start Prefect server in Docker
    docker_cmd = [
        "docker",
        "run",
        "-d",
        "--name",
        container_name,
        "-p",
        f"{port}:4200",
        "prefecthq/prefect:3-latest",
        "prefect",
        "server",
        "start",
        "--host",
        "0.0.0.0",
    ]

    try:
        subprocess.run(docker_cmd, check=True, capture_output=True)

        # Wait for server to be ready
        api_url = f"http://localhost:{port}/api"
        max_retries = 30
        for i in range(max_retries):
            try:
                response = requests.get(f"{api_url}/health", timeout=2)
                if response.status_code == 200:
                    print(f"Prefect server ready at {api_url}")
                    break
            except requests.exceptions.RequestException:
                pass

            if i == max_retries - 1:
                raise RuntimeError("Prefect server did not start in time")

            time.sleep(2)

        yield api_url

    finally:
        # Cleanup: stop and remove container
        subprocess.run(["docker", "stop", container_name], check=False)
        subprocess.run(["docker", "rm", container_name], check=False)


@pytest.fixture
def om_config(prefect_server: str) -> dict:
    """
    OpenMetadata workflow configuration for Prefect connector.
    """
    # Get JWT token from environment variable
    om_jwt = os.environ.get("OM_JWT")
    if not om_jwt:
        pytest.skip("OM_JWT environment variable not set")

    return {
        "source": {
            "type": "prefect",
            "serviceName": "prefect_integration_test",
            "serviceConnection": {
                "config": {
                    "type": "Prefect",
                    "hostPort": prefect_server,
                    "apiKey": "",  # Self-hosted doesn't need API key
                    "numberOfStatus": 10,
                }
            },
            "sourceConfig": {"config": {"type": "PipelineMetadata"}},
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "openMetadataServerConfig": {
                "hostPort": os.environ.get(
                    "OM_HOST_PORT", "http://host.docker.internal:8585/api"
                ),
                "authProvider": "openmetadata",
                "securityConfig": {"jwtToken": om_jwt},
            }
        },
    }
