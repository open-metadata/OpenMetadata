import logging
import pathlib
import sys
import tempfile
import time
import traceback
from datetime import timedelta

import click
import requests as requests

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig

logger = logging.getLogger(__name__)
calc_gb = 1024 * 1024 * 1024
min_memory_limit = 6 * calc_gb


def start_docker(docker, start_time, file_path):
    logger.info("Running docker compose for OpenMetadata..")
    click.secho("It may take some time on the first run", fg="bright_yellow")
    if file_path:
        docker.compose.up(detach=True, build=True)
    else:
        docker.compose.up(detach=True)

    logger.info(
        "Ran docker compose for OpenMetadata successfully.\nWaiting for ingestion to complete.."
    )
    metadata_config = MetadataServerConfig.parse_obj(
        {
            "api_endpoint": "http://localhost:8585/api",
            "auth_provider_type": "no-auth",
        }
    )
    logging.getLogger("metadata.ingestion.ometa.ometa_api").disabled = True
    ometa_client = OpenMetadata(metadata_config)
    while True:
        try:
            resp = ometa_client.get_by_name(
                entity=Table, fqdn="bigquery_gcp.shopify.dim_customer"
            )
            if not resp:
                raise Exception("Error")
            break
        except Exception:
            sys.stdout.write(".")
            sys.stdout.flush()
            time.sleep(5)
    logging.getLogger("metadata.ingestion.ometa.ometa_api").disabled = False
    elapsed = time.time() - start_time
    logger.info(
        f"Time took to get OpenMetadata running: {str(timedelta(seconds=elapsed))}"
    )
    click.secho(
        "\n✅ OpenMetadata is up and running",
        fg="bright_green",
    )
    click.secho(
        """\nOpen http://localhost:8585 in your browser to access OpenMetadata..
        \nTo checkout Ingestion via Airflow, go to http://localhost:8080 \n(username: admin, password: admin)
        """,
        fg="bright_blue",
    )
    click.secho(
        """We are available on Slack , https://slack.open-metadata.org/ . Reach out to us if you have any questions.
        \nIf you like what we are doing, please consider giving us a star on github at https://github.com/open-metadata/OpenMetadata. 
It helps OpenMetadata reach wider audience and helps our community.\n""",
        fg="bright_magenta",
    )


def env_file_check(env_file_path):
    if env_file_path is not None:
        if env_file_path == "":
            raise ValueError("Please provide path to env file")
        else:
            logger.info(f"Using env file from {env_file_path}")
            return pathlib.Path(env_file_path)


def file_path_check(file_path):
    if file_path is None:
        docker_compose_file_path = (
            pathlib.Path(tempfile.gettempdir()) / "docker-compose.yml"
        )
        if not docker_compose_file_path.exists():
            logger.info(
                "Downloading latest docker compose file from openmetadata repository..."
            )
            r = requests.get(
                "https://raw.githubusercontent.com/open-metadata/OpenMetadata/main/docker/metadata/docker-compose.yml"
            )
            with open(docker_compose_file_path, "wb") as docker_compose_file_handle:
                docker_compose_file_handle.write(r.content)
                docker_compose_file_handle.close()
    else:
        if file_path == "":
            raise ValueError("Please Provide Path to local docker-compose.yml file")
        else:
            logger.info(f"Using docker compose file from {file_path}")
            docker_compose_file_path = pathlib.Path(file_path)
    return docker_compose_file_path


def run_docker(start, stop, pause, resume, clean, file_path, env_file_path, reset_db):
    try:
        from python_on_whales import DockerClient

        docker = DockerClient(compose_project_name="openmetadata", compose_files=[])

        logger.info("Checking if docker compose is installed..")
        if not docker.compose.is_installed():
            raise Exception("Docker Compose CLI is not installed on the system.")

        docker_info = docker.info()

        logger.info("Checking if docker service is running..")
        if not docker_info.id:
            raise Exception("Docker Service is not up and running.")

        logger.info("Checking openmetadata memory constraints..")
        if docker_info.mem_total < min_memory_limit:
            raise MemoryError

        # Check for -f <Path>
        start_time = time.time()
        docker_compose_file_path = file_path_check(file_path)
        env_file = env_file_check(env_file_path)
        # Set up Docker Client Config with docker compose file path
        docker = DockerClient(
            compose_project_name="openmetadata",
            compose_files=[docker_compose_file_path],
            compose_env_file=env_file,
        )
        if start:
            start_docker(docker, start_time, file_path)
        if pause:
            logger.info("Pausing docker compose for OpenMetadata..")
            docker.compose.pause()
            logger.info("Pausing docker compose for OpenMetadata successful.")
        if resume:
            logger.info("Resuming docker compose for OpenMetadata..")
            docker.compose.unpause()
            logger.info("Resuming docker compose for OpenMetadata Successful.")
        if stop:
            logger.info("Stopping docker compose for OpenMetadata..")
            docker.compose.stop()
            logger.info("Docker compose for OpenMetadata stopped successfully.")
        if reset_db:

            reset_db_om(docker)
        if clean:
            logger.info(
                "Stopping docker compose for OpenMetadata and removing images, networks, volumes.."
            )
            docker.compose.down(remove_orphans=True, remove_images="all", volumes=True)
            logger.info(
                "Stopped docker compose for OpenMetadata and removing images, networks, volumes."
            )
            if file_path is None:
                docker_compose_file_path.unlink()

    except MemoryError:
        click.secho(
            f"Please Allocate More memory to Docker.\nRecommended: 6GB\nCurrent: "
            f"{round(float(dict(docker_info).get('mem_total')) / calc_gb)}",
            fg="red",
        )
    except Exception as err:
        logger.debug(traceback.format_exc())
        logger.debug(traceback.print_exc())
        click.secho(str(err), fg="red")


def reset_db_om(docker):
    if docker.container.inspect("openmetadata_server").state.running:
        click.secho(
            f"Resetting OpenMetadata.\nThis will clear out all the data",
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
