"""
Dynamically build docker images for
all the connectors
"""
import argparse
import io
import logging
import sys
import traceback
from distutils.core import run_setup
from enum import Enum

import docker

logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logger = logging.getLogger(__name__)

client = docker.from_env()

TARGET = "openmetadata/ingestion-connector-{name}"
DOCKERFILE = "FROM openmetadata/ingestion-connector-base\n"
REQUIREMENTS = "RUN pip install {requirements}\n"
ENTRYPOINT = 'ENTRYPOINT ["python", "main.py"]'


class DockerCommands(Enum):
    BUILD = "build"
    PUSH = "push"


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
            logger.debug(traceback.format_exc())
            logger.warning(f"Error trying to build {conn}: {exc}")


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
            logger.debug(traceback.format_exc())
            logger.warning(f"Error trying to push {conn}: {exc}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Docker Framework for OpenMetadata")
    sub_parser = parser.add_subparsers(dest="command")
    sub_parser.add_parser(DockerCommands.BUILD.value)
    sub_parser.add_parser(DockerCommands.PUSH.value)
    has_args = vars(parser.parse_args())
    if has_args == DockerCommands.BUILD.value:
        build()
    if has_args == DockerCommands.PUSH.value:
        push()
