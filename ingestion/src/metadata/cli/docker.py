import logging
import pathlib
import sys
import tempfile
import time
import traceback
from datetime import timedelta

import click
import requests as requests

logger = logging.getLogger(__name__)

logging.getLogger("urllib3").setLevel(logging.WARN)
# Configure logger.
handler = logging.StreamHandler()
handler.setFormatter(
    logging.Formatter(
        "[%(asctime)s] %(levelname)-8s {%(name)s:%(lineno)d} - %(message)s"
    )
)
logger.addHandler(handler)

calc_gb = 1024 * 1024 * 1000
min_memory_limit = 3 * calc_gb


def run_docker(start, stop, pause, resume, clean, file_path):
    try:
        from python_on_whales import DockerClient

        from metadata.ingestion.ometa.ometa_api import OpenMetadata
        from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig

        docker = DockerClient(compose_project_name="openmetadata", compose_files=[])

        logger.info("Checking if docker compose is installed....")
        if not docker.compose.is_installed():
            raise Exception("Docker Compose CLI is not installed on the system.")

        docker_info = docker.info()

        logger.info("Checking if docker service is running....")
        if not docker_info.id:
            raise Exception("Docker Service is not up and running.")

        logger.info("Checking openmetadata memory constraints....")
        if docker_info.mem_total < min_memory_limit:
            raise MemoryError

        # Check for -f <Path>
        start_time = time.time()
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
        else:
            if file_path == "":
                raise ValueError("Please Provide Path to local docker-compose.yml file")
            else:
                logger.info(f"Using docker compose file from {file_path}")
                docker_compose_file_path = pathlib.Path(file_path)

        # Set up Docker Client Config with docker compose file path
        docker = DockerClient(
            compose_project_name="openmetadata",
            compose_files=[docker_compose_file_path],
        )

        if start:
            logger.info("Running docker compose for Open Metadata....")
            if file_path:
                docker.compose.up(detach=True, build=True)
            else:
                docker.compose.up(detach=True)

            logger.info(
                "Docker Compose for Open Metadata successful. Waiting for ingestion to complete...."
            )
            metadata_config = MetadataServerConfig.parse_obj(
                {
                    "api_endpoint": "http://localhost:8585/api",
                    "auth_provider_type": "no-auth",
                }
            )

            ometa_client = OpenMetadata(metadata_config).client
            while True:
                try:
                    ometa_client.get(f"/tables/name/bigquery_gcp.shopify.dim_customer")
                    break
                except Exception as err:
                    sys.stdout.flush()
                    time.sleep(5)
            elapsed = time.time() - start_time
            logger.info(
                f"Time took to get OpenMetadata running: {str(timedelta(seconds=elapsed))}"
            )
            click.secho(
                "\n✔ OpenMetadata is up and running",
                fg="bright_green",
            )
            click.secho(
                """\nHead to http://localhost:8585 to play around with OpenMetadata UI.
                \nTo checkout Ingestion via Airflow, go to http://localhost:8080 \n(username: admin, password: admin)
                """,
                fg="bright_blue",
            )
            click.secho(
                "Need support? Get in touch on Slack: https://slack.open-metadata.org/",
                fg="bright_magenta",
            )
        if pause:
            logger.info("Pausing docker compose for Open Metadata....")
            docker.compose.pause()
            logger.info("Pausing docker compose for Open Metadata Successful.")
        if resume:
            logger.info("Resuming docker compose for Open Metadata....")
            docker.compose.unpause()
            logger.info("Resuming docker compose for Open Metadata Successful.")
        if stop:
            logger.info("Stopping docker compose for Open Metadata....")
            docker.compose.stop()
            logger.info("docker compose for Open Metadata stopped successfully.")
        if clean:
            logger.info(
                "Stopping docker compose for Open Metadata and removing images, networks, volumes...."
            )
            docker.compose.down(remove_orphans=True, remove_images="all", volumes=True)
            logger.info(
                "Stopped docker compose for Open Metadata and removing images, networks, volumes."
            )
            if file_path is None:
                docker_compose_file_path.unlink()

    except MemoryError:
        click.secho(
            f"Please Allocate More memory to Docker.\nRecommended: 4GB\nCurrent: "
            f"{round(float(docker_info['MemTotal']) / calc_gb, 2)}",
            fg="red",
        )
    except Exception as err:
        logger.debug(traceback.format_exc())
        logger.debug(traceback.print_exc())
        click.secho(str(err), fg="red")
