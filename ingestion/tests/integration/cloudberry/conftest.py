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

import os
from pathlib import Path
from secrets import token_urlsafe

import pytest
from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_utils import wait_for_logs

from metadata.generated.schema.entity.services.databaseService import DatabaseConnection

CLOUDBERRY_IMAGE = "woblerr/cloudberry:2.1.0-incubating-ubuntu22.04-v0.3"
CLOUDBERRY_PORT = 5432
CLOUDBERRY_DATABASE = "om_cloudberry"


@pytest.fixture(scope="session")
def cloudberry_endpoint():
    if host_port := os.getenv("CLOUDBERRY_TEST_HOST_PORT"):
        yield host_port, os.environ["CLOUDBERRY_TEST_PASSWORD"]
        return

    password = token_urlsafe(24)
    catalog = Path(__file__).with_name("cloudberry_catalog.sql").resolve()
    with (
        DockerContainer(CLOUDBERRY_IMAGE)
        .with_env("CLOUDBERRY_PASSWORD", token_urlsafe(24))
        .with_env("CLOUDBERRY_DATABASE_NAME", CLOUDBERRY_DATABASE)
        .with_exposed_ports(CLOUDBERRY_PORT)
        .with_volume_mapping(str(catalog), "/tmp/cloudberry_catalog.sql", "ro")
    ) as container:
        wait_for_logs(container, "INFO - Execute custom init scripts", timeout=180)
        exit_code, output = container.exec(
            [
                "gosu",
                "gpadmin",
                "bash",
                "-c",
                'source /usr/local/cloudberry-db/cloudberry-env.sh && exec psql "$@"',
                "psql",
                "--no-psqlrc",
                "--dbname",
                CLOUDBERRY_DATABASE,
                "--set",
                f"reader_password={password}",
                "--file",
                "/tmp/cloudberry_catalog.sql",
            ]
        )
        assert exit_code == 0, output.decode(errors="replace")
        port = container.get_exposed_port(CLOUDBERRY_PORT)
        yield f"{container.get_container_host_ip()}:{port}", password


@pytest.fixture(scope="module")
def cloudberry_connection(cloudberry_endpoint):
    host_port, password = cloudberry_endpoint
    return DatabaseConnection.model_validate(
        {
            "config": {
                "type": "Cloudberry",
                "hostPort": host_port,
                "username": "om_reader",
                "authType": {"password": password},
                "database": CLOUDBERRY_DATABASE,
            }
        }
    )


@pytest.fixture
def source_config(cloudberry_connection):
    return {
        "type": "cloudberry",
        "serviceName": "cloudberry_test",
        "serviceConnection": cloudberry_connection.model_dump(),
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }
