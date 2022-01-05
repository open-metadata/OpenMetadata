import logging
import pathlib
import subprocess
import tempfile
import time
import traceback
from datetime import timedelta

import click
import requests

logger = logging.getLogger(__name__)
logging.getLogger("urllib3").setLevel(logging.WARN)
min_memory_limit = 3 * 1024 * 1024 * 1000
calc_gb = 1024 * 1024 * 1000
# Configure logger.
BASE_LOGGING_FORMAT = (
    "[%(asctime)s] %(levelname)-8s {%(name)s:%(lineno)d} - %(message)s"
)
logging.basicConfig(format=BASE_LOGGING_FORMAT)


def run_docker(start, stop, clean, type, path):

    try:
        import docker as sys_docker

        from metadata.ingestion.ometa.ometa_api import OpenMetadata
        from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig

        client = sys_docker.from_env()
        docker_info = client.info()

        if docker_info["MemTotal"] < min_memory_limit:
            raise MemoryError
        if start:
            if type == "local":
                logger.info("Running Local Docker")
                if path == "":
                    raise ValueError(
                        "Please Provide Path to local docker-compose.yml file"
                    )
                start_time = time.time()
                subprocess.run(
                    f"docker-compose -f {path} up --build -d",
                    shell=True,
                )
                elapsed = time.time() - start_time
                logger.info(
                    f"Time took to get containers running: {str(timedelta(seconds=elapsed))}"
                )
            else:
                logger.info("Running Latest Release Docker")

                r = requests.get(
                    "https://raw.githubusercontent.com/open-metadata/OpenMetadata/main/docker/metadata/docker-compose.yml"
                )

                docker_compose_file_path = (
                    pathlib.Path(tempfile.gettempdir()) / "docker-compose.yml"
                )
                with open(docker_compose_file_path, "wb") as docker_compose_file_handle:
                    docker_compose_file_handle.write(r.content)

                start_time = time.time()

                logger.info(f"docker-compose -f {docker_compose_file_path} up -d")
                subprocess.run(
                    f"docker-compose -f {docker_compose_file_path} up -d", shell=True
                )
                elapsed = time.time() - start_time
                logger.info(
                    f"Time took to get containers running: {str(timedelta(seconds=elapsed))}"
                )

                docker_compose_file_path.unlink(missing_ok=True)

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
                    sys.stdout.write(".")
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
        elif stop:
            for container in client.containers.list():
                if "openmetadata_" in container.name:
                    logger.info(f"Stopping {container.name}")
                    container.stop()
        elif clean:
            logger.info("Removing Containers")

            for container in client.containers.list({all: True}):
                if "openmetadata_" in container.name:
                    container.remove(v=True, force=True)
            logger.info("Removing Networks")
            for network in client.networks.list():
                if "app_net" in network.name:
                    network.remove()
    except (ImportError, ModuleNotFoundError):
        click.secho(
            "Docker package not found, can you try `pip install 'openmetadata-ingestion[docker]'`",
            fg="yellow",
        )
    except MemoryError:
        click.secho(
            f"Please Allocate More memory to Docker.\nRecommended: 4GB\nCurrent: "
            f"{round(float(docker_info['MemTotal']) / calc_gb, 2)}",
            fg="red",
        )
    except sys_docker.errors.DockerException as err:
        click.secho(f"Error: Docker service is not up and running. {err}", fg="red")
    except Exception as err:
        logger.error(traceback.format_exc())
        logger.error(traceback.print_exc())
        click.secho(str(err), fg="red")
