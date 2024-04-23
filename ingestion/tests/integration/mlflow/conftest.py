"""
Environment fixtures to be able to test the MLFlow Ingestion Pipeline.

The following steps are taken:
1. Build the MLFlow image with needed dependencies
2. Get a testcontainer Container for
    - MlFlow Image
    - MySQL
    - MinIO
    * For each container, an open port is found to be able to reach it from the host.
3. A Docker Network is created so that they can reach each other easily without the need to use the host.
4. The containers are started
5. Any specific configuration is done
6. Needed configurations are yielded back to the test.
"""
import io
import sys
from dataclasses import asdict, dataclass
from typing import Optional

import pytest
from testcontainers.core.container import DockerContainer
from testcontainers.core.docker_client import DockerClient
from testcontainers.mysql import MySqlContainer

# HACK: This test is only possible for Python3.9 or higher.
# This allows pytest to parse the file even on lower verions.
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
    username: str = "mlflow"
    password: str = "password"
    dbname: str = "experiments"
    port: int = 3306
    container_name: str = "mlflow-db"
    exposed_port: Optional[int] = None

    def with_exposed_port(self, container):
        self.exposed_port = container.get_exposed_port(self.port)


@dataclass
class MinioContainerConfigs:
    """MinIO Configurations"""

    access_key: str = "minio"
    secret_key: str = "password"
    port: int = 9000
    container_name: str = "mlflow-artifact"
    exposed_port: Optional[int] = None

    def with_exposed_port(self, container):
        self.exposed_port = container.get_exposed_port(self.port)


@dataclass
class MlflowContainerConfigs:
    """MLFlow Configurations"""

    backend_uri: str = "mysql+pymysql://mlflow:password@mlflow-db:3306/experiments"
    artifact_bucket: str = "mlops.local.com"
    port: int = 6000
    exposed_port: Optional[int] = None

    def with_exposed_port(self, container):
        self.exposed_port = container.get_exposed_port(self.port)


class MlflowTestConfiguration:
    """Responsible to hold all the configurations used by the test"""

    def __init__(self):
        self.mysql_configs = MySqlContainerConfigs()
        self.minio_configs = MinioContainerConfigs()
        self.mlflow_configs = MlflowContainerConfigs()


# ------------------------------------------------------------
# Fixture to setup the environment
# ------------------------------------------------------------
@pytest.fixture(scope="session")
def mlflow_environment():
    config = MlflowTestConfiguration()

    docker_network = get_docker_network()

    minio_container = get_minio_container(config.minio_configs)
    mysql_container = get_mysql_container(config.mysql_configs)
    mlflow_container = build_and_get_mlflow_container(config.mlflow_configs)

    with docker_network:
        minio_container.with_network(docker_network)
        mysql_container.with_network(docker_network)
        mlflow_container.with_network(docker_network)
        with mysql_container, minio_container, mlflow_container:
            # minio setup
            minio_client = minio_container.get_client()
            minio_client.make_bucket(config.mlflow_configs.artifact_bucket)

            config.mysql_configs.with_exposed_port(mysql_container)
            config.minio_configs.with_exposed_port(minio_container)
            config.mlflow_configs.with_exposed_port(mlflow_container)

            yield config


# ------------------------------------------------------------
# Utility functions
# ------------------------------------------------------------
def get_docker_network(name: str = "docker_mlflow_test_nw"):
    network = Network()
    network.name = name
    return network


def build_and_get_mlflow_container(mlflow_config: MlflowContainerConfigs):
    docker_client = DockerClient()

    dockerfile = io.BytesIO(
        b"""
        FROM python:3.10-slim-buster
        RUN python -m pip install --upgrade pip
        RUN pip install cryptography mlflow boto3 pymysql
        """
    )

    docker_client.client.images.build(fileobj=dockerfile, tag="mlflow_image:latest")

    container = DockerContainer("mlflow_image:latest")
    container.with_bind_ports(mlflow_config.port, 8778)
    container.with_command(
        f"mlflow server --backend-store-uri {mlflow_config.backend_uri} --default-artifact-root s3://{mlflow_config.artifact_bucket} --host 0.0.0.0 --port {mlflow_config.port}"
    )

    return container


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
