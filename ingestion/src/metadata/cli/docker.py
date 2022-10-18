#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Docker functions for CLI
"""
import json
import pathlib
import sys
import tempfile
import time
import traceback
from base64 import b64encode
from datetime import timedelta
from typing import Optional

import click
import requests
from requests._internal_utils import to_native_string

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.client_version import get_client_version
from metadata.utils.logger import cli_logger, ometa_logger

logger = cli_logger()
CALC_GB = 1024 * 1024 * 1024
MIN_MEMORY_LIMIT = 6 * CALC_GB
RELEASE_BRANCH_VERSION = get_client_version()
REQUESTS_TIMEOUT = 60 * 5

DOCKER_URL_ROOT = (
    "https://raw.githubusercontent.com/open-metadata/OpenMetadata/"
    f"{RELEASE_BRANCH_VERSION}/docker/metadata/"
)

DEFAULT_COMPOSE_FILE = "docker-compose.yml"
BACKEND_DATABASES = {
    "mysql": DEFAULT_COMPOSE_FILE,
    "postgres": "docker-compose-postgres.yml",
}
DEFAULT_JWT_TOKEN = (
    "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9"
    ".eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg"
    "0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiE"
    "C0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQh"
    "yNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLw"
    "Sl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTn"
    "P49U493VanKpUAfzIiOiIbhg"
)


def start_docker(docker, start_time, file_path, ingest_sample_data: bool):
    """
    Method for starting up the docker containers
    """

    logger.info("Running docker compose for OpenMetadata..")
    click.secho("It may take some time on the first run", fg="bright_yellow")
    if file_path:
        docker.compose.up(detach=True, build=True)
    else:
        docker.compose.up(detach=True)

    logger.info("Ran docker compose for OpenMetadata successfully.")
    if ingest_sample_data:
        logger.info("Waiting for ingestion to complete..")
        wait_for_containers(docker)
        run_sample_data()
        metadata_config = OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="openmetadata",
            securityConfig=OpenMetadataJWTClientConfig(jwtToken=DEFAULT_JWT_TOKEN),
        )
        ometa_logger().disabled = True
        ometa_client = OpenMetadata(metadata_config)
        while True:
            try:
                resp = ometa_client.get_by_name(
                    entity=Table, fqn="sample_data.ecommerce_db.shopify.dim_customer"
                )
                if not resp:
                    raise Exception("Error")
                break
            except Exception:
                sys.stdout.write(".")
                sys.stdout.flush()
                time.sleep(5)
        ometa_logger().disabled = False

    # Wait until docker is not only running, but the server is up
    click.secho(
        "Waiting for server to be up at http://localhost:8585", fg="bright_yellow"
    )
    while True:
        try:
            res = requests.get("http://localhost:8585", timeout=REQUESTS_TIMEOUT)
            if res.status_code == 200:
                break
        except Exception:
            pass
        time.sleep(5)

    elapsed = time.time() - start_time
    logger.info(
        f"Time taken to get OpenMetadata running: {str(timedelta(seconds=elapsed))}"
    )
    click.secho(
        "\n✅  OpenMetadata is up and running",
        fg="bright_green",
    )
    click.secho(
        "\nOpen http://localhost:8585 in your browser to access OpenMetadata."
        "\nTo checkout Ingestion via Airflow, go to http://localhost:8080 \n(username: admin, password: admin)",
        fg="bright_blue",
    )
    click.secho(
        "We are available on Slack, https://slack.open-metadata.org/. Reach out to us if you have any questions."
        "\nIf you like what we are doing, please consider giving us a star on github at"
        " https://github.com/open-metadata/OpenMetadata. It helps OpenMetadata reach wider audience and helps"
        " our community.\n",
        fg="bright_magenta",
    )


def env_file_check(env_file_path) -> Optional[pathlib.Path]:
    """
    Method for checking if the env file path is valid
    """
    if env_file_path is not None:
        if env_file_path == "":
            raise ValueError("Please provide path to env file")
        logger.info(f"Using env file from {env_file_path}")
        return pathlib.Path(env_file_path)

    return None


def file_path_check(file_path, database: str):
    """
    Method for checking if the file path is valid
    """

    docker_compose_file_name = BACKEND_DATABASES.get(database) or DEFAULT_COMPOSE_FILE

    if file_path is None:
        docker_compose_file_path = (
            pathlib.Path(tempfile.gettempdir()) / docker_compose_file_name
        )
        if not docker_compose_file_path.exists():
            logger.info(
                f"Downloading latest docker compose file {docker_compose_file_name} from openmetadata repository..."
            )
            resp = requests.get(
                f"{DOCKER_URL_ROOT}{docker_compose_file_name}", timeout=REQUESTS_TIMEOUT
            )
            with open(docker_compose_file_path, "wb") as docker_compose_file_handle:
                docker_compose_file_handle.write(resp.content)
                docker_compose_file_handle.close()
    else:
        if file_path == "":
            raise ValueError("Please Provide Path to local docker-compose.yml file")
        logger.info(f"Using docker compose file from {file_path}")
        docker_compose_file_path = pathlib.Path(file_path)
    return docker_compose_file_path


# to clean linting after https://github.com/open-metadata/OpenMetadata/issues/8081
def run_docker(  # pylint: disable=too-many-arguments,too-many-locals
    start: bool,
    stop: bool,
    pause: bool,
    resume: bool,
    clean: bool,
    file_path: str,
    env_file_path: str,
    reset_db: bool,
    ingest_sample_data: bool,
    database: str,
):
    """
    Main method for the OpenMetadata docker commands
    """
    try:
        # We just want to import docker client when needed
        from python_on_whales import (  # pylint: disable=import-outside-toplevel
            DockerClient,
        )

        docker = DockerClient(compose_project_name="openmetadata", compose_files=[])

        logger.info("Checking if docker compose is installed...")
        if not docker.compose.is_installed():
            raise Exception("Docker Compose CLI is not installed on the system.")

        docker_info = docker.info()

        logger.info("Checking if docker service is running...")
        if not docker_info.id:
            raise Exception("Docker Service is not up and running.")

        logger.info("Checking openmetadata memory constraints...")
        if docker_info.mem_total < MIN_MEMORY_LIMIT:
            raise MemoryError

        # Check for -f <Path>
        start_time = time.time()
        docker_compose_file_path = file_path_check(file_path, database)
        env_file = env_file_check(env_file_path)
        # Set up Docker Client Config with docker compose file path
        docker = DockerClient(
            compose_project_name="openmetadata",
            compose_files=[docker_compose_file_path],
            compose_env_file=env_file,
        )
        if start:
            start_docker(docker, start_time, file_path, ingest_sample_data)
        if pause:
            logger.info("Pausing docker compose for OpenMetadata...")
            docker.compose.pause()
            logger.info("Pausing docker compose for OpenMetadata successful.")
        if resume:
            logger.info("Resuming docker compose for OpenMetadata...")
            docker.compose.unpause()
            logger.info("Resuming docker compose for OpenMetadata Successful.")
        if stop:
            logger.info("Stopping docker compose for OpenMetadata...")
            docker.compose.stop()
            logger.info("Docker compose for OpenMetadata stopped successfully.")
        if reset_db:
            reset_db_om(docker)
        if clean:
            logger.info(
                "Stopping docker compose for OpenMetadata and removing images, networks, volumes..."
            )
            docker.compose.down(remove_orphans=True, remove_images="all", volumes=True)
            logger.info(
                "Stopped docker compose for OpenMetadata and removing images, networks, volumes."
            )
            if file_path is None:
                docker_compose_file_path.unlink()

    except MemoryError:
        logger.debug(traceback.format_exc())
        click.secho(
            f"Please Allocate More memory to Docker.\nRecommended: 6GB+\nCurrent: "
            f"{round(float(dict(docker_info).get('mem_total')) / CALC_GB)}",
            fg="red",
        )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        click.secho(str(exc), fg="red")


def reset_db_om(docker):
    """
    Reset the OpenMetadata Database and clear everything in the DB
    """

    if docker.container.inspect("openmetadata_server").state.running:
        click.secho(
            "Resetting OpenMetadata.\nThis will clear out all the data",
            fg="red",
        )
        docker.container.execute(
            container="openmetadata_server",
            tty=True,
            command=[
                "/bin/bash",
                "-c",
                "./openmetadata-*/bootstrap/bootstrap_storage.sh drop-create-all",
            ],
        )
    else:
        click.secho("OpenMetadata Instance is not up and running", fg="yellow")


def wait_for_containers(docker) -> None:
    """
    Wait until docker containers are running
    """
    while True:
        running = (
            docker.container.inspect("openmetadata_server").state.running
            and docker.container.inspect("openmetadata_ingestion").state.running
        )
        if running:
            break
        sys.stdout.write(".")
        sys.stdout.flush()
        time.sleep(5)


def run_sample_data() -> None:
    """
    Trigger sample data DAGs
    """
    base_url = "http://localhost:8080/api"
    dags = ["sample_data", "sample_usage", "index_metadata"]

    client_config = ClientConfig(
        base_url=base_url,
        auth_header="Authorization",
        auth_token_mode="Basic",
        access_token=to_native_string(
            b64encode(b":".join(("admin".encode(), "admin".encode()))).strip()
        ),
    )
    client = REST(client_config)
    timeout = time.time() + 60 * 5  # Timeout of 5 minutes
    while True:
        try:
            resp = client.get("/dags")
            if resp:
                break
            if time.time() > timeout:
                raise TimeoutError("Ingestion container timed out")
        except TimeoutError as err:
            logger.debug(traceback.format_exc())
            sys.stdout.write(str(err))
            sys.exit(1)
        except Exception:
            sys.stdout.write(".")
            time.sleep(5)
    for dag in dags:
        json_sample_data = {"is_paused": False}
        client.patch(f"/dags/{dag}", data=json.dumps(json_sample_data))
