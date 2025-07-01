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
import time
from dataclasses import dataclass
from typing import Optional

import pymysql
import pytest
from testcontainers.core.container import DockerContainer
from testcontainers.core.docker_client import DockerClient

from ....containers import (
    MinioContainerConfigs,
    MySqlContainerConfigs,
    get_docker_network,
    get_minio_container,
    get_mysql_container,
)


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
        self.mysql_configs = MySqlContainerConfigs(
            username="mlflow",
            password="password",
            dbname="experiments",
            container_name="mlflow-db",
        )
        self.minio_configs = MinioContainerConfigs(container_name="mlflow-artifact")
        self.mlflow_configs = MlflowContainerConfigs()


# ------------------------------------------------------------
# Fixture to setup the environment
# ------------------------------------------------------------
@pytest.fixture(scope="session")
def mlflow_environment():
    config = MlflowTestConfiguration()

    docker_network = get_docker_network(name="docker_mlflow_test_nw")

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

            # Wait for MySQL to be ready
            port = config.mysql_configs.exposed_port or 3306
            for _ in range(30):
                try:
                    conn = pymysql.connect(
                        host="localhost",
                        port=int(port),
                        user="mlflow",
                        password="password",
                    )
                    conn.close()
                    break
                except Exception:
                    time.sleep(2)
            else:
                raise RuntimeError("MySQL did not become ready in time.")

            yield config


def build_and_get_mlflow_container(mlflow_config: MlflowContainerConfigs):
    docker_client = DockerClient()

    dockerfile = io.BytesIO(
        b"""
        FROM python:3.10-slim-buster
        RUN python -m pip install --upgrade pip
        RUN pip install cryptography "mlflow==2.22.1" boto3 pymysql
        """
    )

    docker_client.client.images.build(fileobj=dockerfile, tag="mlflow_image:latest")

    container = DockerContainer("mlflow_image:latest")
    container.with_bind_ports(mlflow_config.port, 8778)
    container.with_command(
        f"mlflow server --backend-store-uri {mlflow_config.backend_uri} --default-artifact-root s3://{mlflow_config.artifact_bucket} --host 0.0.0.0 --port {mlflow_config.port}"
    )

    return container
