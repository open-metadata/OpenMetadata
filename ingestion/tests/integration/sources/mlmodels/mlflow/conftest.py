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
import uuid
from dataclasses import dataclass
from typing import Optional

import pymysql
import pytest
from docker.errors import ImageNotFound
from testcontainers.core.container import DockerContainer
from testcontainers.core.docker_client import DockerClient

from _openmetadata_testutils.helpers.docker import try_bind

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
    container_name: Optional[str] = None
    image_tag: Optional[str] = None

    def with_exposed_port(self, container):
        self.exposed_port = container.get_exposed_port(self.port)


class MlflowTestConfiguration:
    """Responsible to hold all the configurations used by the test"""

    def __init__(self):
        suffix = uuid.uuid4().hex[:8]
        self.mysql_configs = MySqlContainerConfigs(
            username="mlflow",
            password="password",
            dbname="experiments",
            container_name=f"mlflow-db-{suffix}",
        )
        self.minio_configs = MinioContainerConfigs(
            container_name=f"mlflow-artifact-{suffix}"
        )
        self.mlflow_configs = MlflowContainerConfigs(container_name=f"mlflow-{suffix}")
        self.network_name = f"docker_mlflow_test_nw_{suffix}"


# ------------------------------------------------------------
# Fixture to setup the environment
# ------------------------------------------------------------
@pytest.fixture(scope="session")
def mlflow_environment():
    config = MlflowTestConfiguration()

    docker_network = get_docker_network(name=config.network_name)

    minio_container = get_minio_container(config.minio_configs)
    mysql_container = get_mysql_container(config.mysql_configs)
    mlflow_container = build_and_get_mlflow_container(config.mlflow_configs)

    try:
        with docker_network:
            minio_container = minio_container.with_network(
                docker_network
            ).with_network_aliases("mlflow-artifact")
            mysql_container = mysql_container.with_network(
                docker_network
            ).with_network_aliases("mlflow-db")
            mlflow_container = mlflow_container.with_network(
                docker_network
            ).with_network_aliases("mlflow")
            with mysql_container as mysql, minio_container as minio, try_bind(
                mlflow_container, config.mlflow_configs.port, None
            ) as mlflow:
                # minio setup
                minio_client = minio.get_client()
                minio_client.make_bucket(config.mlflow_configs.artifact_bucket)

                config.mysql_configs.with_exposed_port(mysql)
                config.minio_configs.with_exposed_port(minio)
                config.mlflow_configs.with_exposed_port(mlflow)

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
    finally:
        if config.mlflow_configs.image_tag:
            docker_client = DockerClient()
            try:
                docker_client.client.images.remove(
                    config.mlflow_configs.image_tag, force=True
                )
            except ImageNotFound:
                pass


def build_and_get_mlflow_container(mlflow_config: MlflowContainerConfigs):
    docker_client = DockerClient()
    image_tag = f"mlflow_image:{uuid.uuid4().hex}"

    dockerfile = io.BytesIO(
        b"""
        FROM python:3.10-slim-buster
        RUN python -m pip install --upgrade pip
        RUN pip install cryptography "mlflow==2.22.1" boto3 pymysql
        """
    )

    docker_client.client.images.build(fileobj=dockerfile, tag=image_tag)

    container = DockerContainer(image_tag)
    container.with_name(mlflow_config.container_name or f"mlflow-{uuid.uuid4().hex}")
    container.with_command(
        f"mlflow server --backend-store-uri {mlflow_config.backend_uri} --default-artifact-root s3://{mlflow_config.artifact_bucket} --host 0.0.0.0 --port {mlflow_config.port}"
    )
    mlflow_config.image_tag = image_tag

    return container
