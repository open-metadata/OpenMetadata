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
StarRocks integration test fixtures
"""
import time
from typing import Generator

import pytest
from sqlalchemy import create_engine, text

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)


def wait_for_starrocks(host: str, port: int, timeout: int = 120) -> bool:
    """Wait for StarRocks to be ready"""
    import socket

    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex((host, port))
            sock.close()
            if result == 0:
                time.sleep(5)
                return True
        except OSError:
            # StarRocks may not be ready yet; ignore connection errors and retry until timeout
            pass
        time.sleep(2)
    return False


@pytest.fixture(scope="module")
def starrocks_container(tmp_path_factory):
    """
    Start StarRocks containers for integration testing.

    StarRocks requires both Frontend (FE) and Backend (BE) components.
    This fixture uses docker-compose to start the StarRocks cluster.

    Note: This is a placeholder that uses a simple StarRocks Docker setup.
    For full integration, you may need to use docker-compose with FE and BE containers.
    """
    try:
        from testcontainers.core.container import DockerContainer
        from testcontainers.core.waiting_utils import wait_for_logs
    except ImportError:
        pytest.skip("testcontainers not installed")

    container = (
        DockerContainer("starrocks/allin1-ubuntu:latest")
        .with_exposed_ports(9030, 8030, 8040)
        .with_env("STARROCKS_FE_HTTP_PORT", "8030")
        .with_env("STARROCKS_FE_QUERY_PORT", "9030")
    )

    container.start()

    try:
        wait_for_logs(container, ".*Started.*", timeout=120)
    except Exception:
        # Log pattern may not appear; continue and rely on socket check below
        pass

    host = container.get_container_host_ip()
    port = container.get_exposed_port(9030)

    if not wait_for_starrocks(host, int(port), timeout=120):
        container.stop()
        pytest.skip("StarRocks container failed to start")

    connection_url = f"starrocks://root:@{host}:{port}"

    try:
        engine = create_engine(connection_url)
        with engine.connect() as conn:
            conn.execute(text("CREATE DATABASE IF NOT EXISTS test_db"))
            conn.execute(
                text(
                    """
                CREATE TABLE IF NOT EXISTS test_db.test_table (
                    id INT,
                    name VARCHAR(255),
                    created_at DATETIME
                ) ENGINE=OLAP
                PRIMARY KEY(id)
                DISTRIBUTED BY HASH(id) BUCKETS 3
                PROPERTIES ("replication_num" = "1")
            """
                )
            )
            conn.execute(
                text(
                    """
                INSERT INTO test_db.test_table VALUES
                (1, 'Alice', '2024-01-01 10:00:00'),
                (2, 'Bob', '2024-01-02 11:00:00'),
                (3, 'Charlie', '2024-01-03 12:00:00')
            """
                )
            )
            conn.execute(
                text(
                    """
                CREATE VIEW IF NOT EXISTS test_db.test_view AS
                SELECT id, name FROM test_db.test_table WHERE id > 1
            """
                )
            )
        engine.dispose()
    except Exception as e:
        container.stop()
        pytest.skip(f"Failed to set up StarRocks test data: {e}")

    yield {
        "host": host,
        "port": port,
        "username": "root",
        "password": "",
        "database": "test_db",
    }

    container.stop()


@pytest.fixture(scope="module")
def create_service_request(starrocks_container, tmp_path_factory) -> Generator:
    """Create a service request for StarRocks"""
    return CreateDatabaseServiceRequest.model_validate(
        {
            "name": "docker_test_" + tmp_path_factory.mktemp("starrocks").name,
            "serviceType": DatabaseServiceType.StarRocks.value,
            "connection": {
                "config": {
                    "type": "StarRocks",
                    "username": starrocks_container["username"],
                    "password": starrocks_container["password"],
                    "hostPort": f"{starrocks_container['host']}:{starrocks_container['port']}",
                    "databaseSchema": starrocks_container["database"],
                }
            },
        }
    )
