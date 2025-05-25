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
"""Common containers for integration tests"""
import sys
from dataclasses import asdict, dataclass
from typing import Optional

from testcontainers.mysql import MySqlContainer

# HACK: This test is only possible for Python3.9 or higher.
# This allows pytest to parse the file even on lower versions.
if sys.version_info >= (3, 9):
    from testcontainers.core.network import Network
    from testcontainers.minio import MinioContainer
else:
    from unittest.mock import MagicMock

    Network = MagicMock()
    MinioContainer = MagicMock()


# ------------------------------------------------------------
# Container Configurations
# ------------------------------------------------------------
@dataclass
class MySqlContainerConfigs:
    """MySQL Configurations"""

    image: str = "mysql:8"
    username: str = "user"
    password: str = "password"
    dbname: str = "db"
    port: int = 3306
    container_name: str = "test-db"
    exposed_port: Optional[int] = None

    def with_exposed_port(self, container):
        self.exposed_port = container.get_exposed_port(self.port)


@dataclass
class MinioContainerConfigs:
    """MinIO Configurations"""

    access_key: str = "minio"
    secret_key: str = "password"
    port: int = 9000
    container_name: Optional[str] = None
    exposed_port: Optional[int] = None

    def with_exposed_port(self, container):
        self.exposed_port = container.get_exposed_port(self.port)


# ------------------------------------------------------------
# Utility functions
# ------------------------------------------------------------
def get_docker_network(name: str):
    network = Network()
    network.name = name
    return network


def get_mysql_container(mysql_config: MySqlContainerConfigs):
    container = MySqlContainer(
        **{
            k: v
            for k, v in asdict(mysql_config).items()
            if k not in ["exposed_port", "container_name"]
        }
    )
    container.with_name(mysql_config.container_name)

    return container


def get_minio_container(minio_config: MinioContainerConfigs):
    container = MinioContainer(
        **{
            k: v
            for k, v in asdict(minio_config).items()
            if k not in ["exposed_port", "container_name"]
        }
    )
    container.with_name(minio_config.container_name)

    return container
