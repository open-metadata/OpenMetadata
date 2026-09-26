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
from dataclasses import asdict, dataclass
from typing import Optional

from minio import Minio
from testcontainers.core.container import DockerContainer
from testcontainers.core.network import Network
from testcontainers.core.waiting_utils import wait_container_is_ready
from testcontainers.mysql import MySqlContainer


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


class S3ProxyContainer(DockerContainer):
    """S3-compatible object storage, backed by S3Proxy (https://github.com/gaul/s3proxy).

    Stands in for MinIO, whose image was deleted from Docker Hub. S3Proxy is
    Apache-2.0, multi-arch and boots in well under a second.

    S3Proxy answers ``NotImplemented`` to bucket/object tagging and bucket
    lifecycle, so tests must not depend on those calls succeeding.
    """

    def __init__(
        self, image: str, access_key: str, secret_key: str, port: int = 9000, **kwargs
    ):
        super().__init__(image, **kwargs)
        self.access_key = access_key
        self.secret_key = secret_key
        self.port = port
        self.with_exposed_ports(port)
        # S3Proxy listens on :80 out of the box; move it to the S3 port the
        # ingestion configs and network aliases already assume.
        self.with_env("S3PROXY_ENDPOINT", f"http://0.0.0.0:{port}")
        self.with_env("S3PROXY_AUTHORIZATION", "aws-v2-or-v4")
        self.with_env("S3PROXY_IDENTITY", access_key)
        self.with_env("S3PROXY_CREDENTIAL", secret_key)

    def get_client(self) -> Minio:
        return Minio(
            f"{self.get_container_host_ip()}:{self.get_exposed_port(self.port)}",
            access_key=self.access_key,
            secret_key=self.secret_key,
            secure=False,
        )

    @wait_container_is_ready(Exception)
    def _wait_until_serving(self) -> None:
        self.get_client().list_buckets()

    def start(self, *args, **kwargs):
        super().start(*args, **kwargs)
        self._wait_until_serving()
        return self


@dataclass
class S3ContainerConfigs:
    """S3-compatible object storage configuration"""

    image: str = "andrewgaul/s3proxy:4.1.1"
    access_key: str = "accesskey"
    secret_key: str = "secretkey"
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


def get_s3_container(s3_config: S3ContainerConfigs):
    container = S3ProxyContainer(
        **{
            k: v
            for k, v in asdict(s3_config).items()
            if k not in ["exposed_port", "container_name"]
        }
    )
    container.with_name(s3_config.container_name)

    return container
