"""
Dynamically build docker images for
all the connectors
"""
import io
import logging
import sys
from distutils.core import run_setup

import click
import docker

logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logger = logging.getLogger(__name__)

client = docker.from_env()

TARGET = "openmetadata/ingestion-connector-{name}"
DOCKERFILE = "FROM openmetadata/ingestion-connector-base\n"
REQUIREMENTS = "RUN pip install {requirements}\n"
ENTRYPOINT = 'ENTRYPOINT ["python", "main.py"]'


def get_setup_data():
    """
    Get setup and filtered plugins data from setup.py
    """

    setup = run_setup("./ingestion/setup.py", stop_after="init")
    plugins = {
        item[0]: item[1]
        for item in setup.extras_require.items()
        if item[0] not in {"base", "all"}
    }

    return setup, plugins


@click.group()
def cli():
    pass


@click.command()
def build():
    """
    Build all docker images for the connectors
    """

    setup, plugins = get_setup_data()

    for conn in plugins.keys():
        logger.info(f"Building docker image for {conn}")
        conn_reqs = " ".join((f'"{req}"' for req in plugins[conn]))

        if plugins[conn]:
            file = DOCKERFILE + REQUIREMENTS.format(requirements=conn_reqs) + ENTRYPOINT
        else:
            file = DOCKERFILE + ENTRYPOINT

        target = TARGET.format(name=conn)

        try:
            client.images.build(
                fileobj=io.BytesIO(file.encode()), tag=f"{target}:latest"
            )
        except Exception as exc:
            logger.error(f"Error trying to build {conn}", exc)


@click.command()
def push():
    """
    Push the previously built images for the connectors
    to DockerHub
    """

    setup, plugins = get_setup_data()

    for conn in plugins.keys():
        logger.info(f"Pushing docker image for {conn}")

        target = TARGET.format(name=conn)

        try:
            client.images.push(
                f"{target}:{setup.get_version()}",
                stream=True,
                decode=True,
            )
        except Exception as exc:
            logger.error(f"Error trying to push {conn}", exc)


cli.add_command(build)
cli.add_command(push)


if __name__ == "__main__":
    cli()
