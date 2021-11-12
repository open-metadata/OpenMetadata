#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
import logging
import os
import pathlib
import subprocess
import sys
import time
from datetime import timedelta

import click
import requests as requests
from pydantic import ValidationError

try:
    import docker as sys_docker
except ImportError:
    raise ImportError(
        "docker package not found, can you try `pip install 'openmetadata-ingestion[docker]'`"
    )

from metadata.config.common import load_config_file
from metadata.ingestion.api.workflow import Workflow

logger = logging.getLogger(__name__)

logging.getLogger("urllib3").setLevel(logging.WARN)
min_memory_limit = 3 * 1024 * 1024 * 1000
calc_gb = 1024 * 1024 * 1000

# Configure logger.
BASE_LOGGING_FORMAT = (
    "[%(asctime)s] %(levelname)-8s {%(name)s:%(lineno)d} - %(message)s"
)
logging.basicConfig(format=BASE_LOGGING_FORMAT)


@click.group()
def check() -> None:
    pass


@click.group()
@click.option("--debug/--no-debug", default=False)
def metadata(debug: bool) -> None:
    if os.getenv("METADATA_DEBUG", False):
        logging.getLogger().setLevel(logging.INFO)
        logging.getLogger("metadata").setLevel(logging.DEBUG)
    else:
        logging.getLogger().setLevel(logging.WARNING)
        logging.getLogger("metadata").setLevel(logging.INFO)


@metadata.command()
@click.option(
    "-c",
    "--config",
    type=click.Path(exists=True, dir_okay=False),
    help="Workflow config",
    required=True,
)
def ingest(config: str) -> None:
    """Main command for ingesting metadata into Metadata"""
    config_file = pathlib.Path(config)
    workflow_config = load_config_file(config_file)

    try:
        logger.info(f"Using config: {workflow_config}")
        workflow = Workflow.create(workflow_config)
    except ValidationError as e:
        click.echo(e, err=True)
        sys.exit(1)

    workflow.execute()
    workflow.stop()
    ret = workflow.print_status()
    sys.exit(ret)


@metadata.command()
@click.option(
    "-c",
    "--config",
    type=click.Path(exists=True, dir_okay=False),
    help="Workflow config",
    required=True,
)
def report(config: str) -> None:
    """Report command to generate static pages with metadata"""
    config_file = pathlib.Path(config)
    workflow_config = load_config_file(config_file)
    file_sink = {"type": "file", "config": {"filename": "/tmp/datasets.json"}}

    try:
        logger.info(f"Using config: {workflow_config}")
        if workflow_config.get("sink"):
            del workflow_config["sink"]
        workflow_config["sink"] = file_sink
        ### add json generation as the sink
        workflow = Workflow.create(workflow_config)
    except ValidationError as e:
        click.echo(e, err=True)
        sys.exit(1)

    workflow.execute()
    workflow.stop()
    ret = workflow.print_status()
    os.environ.setdefault(
        "DJANGO_SETTINGS_MODULE", "metadata_server.openmetadata.settings"
    )
    try:
        from django.core.management import call_command
        from django.core.wsgi import get_wsgi_application

        application = get_wsgi_application()
        call_command("runserver", "localhost:8000")
    except ImportError as exc:
        logger.error(exc)
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc


def get_containers(client):
    stop_containers = client.containers.list(
        all=True, filters={"label": "com.docker.compose.project=local-metadata"}
    )
    if len(stop_containers) == 0:
        return client.containers.list(
            all=True, filters={"label": "com.docker.compose.project=tmp"}
        )
    return stop_containers


@metadata.command()
@click.option("--run", is_flag=True)
@click.option("--stop", is_flag=True)
@click.option("--clean", is_flag=True)
@click.option(
    "-t",
    "--type",
    default="release",
    required=False,
)
@click.option(
    "-p",
    "--path",
    type=click.Path(exists=True, dir_okay=False),
    required=False,
)
def docker(run, stop, clean, type, path) -> None:
    """
    Checks Docker Memory Allocation
    Run Latest Release Docker - metadata docker --run
    Run Local Docker - metadata docker --run -t local -p path/to/docker-compose.yml
    """
    try:
        try:
            client = sys_docker.from_env()
        except sys_docker.errors.DockerException as err:
            logger.error(f"Error: Docker service is not up and running. {err}")
        docker_info = client.info()
        if docker_info["MemTotal"] < min_memory_limit:
            raise MemoryError(
                f"Please Allocate More memory to Docker.\nRecommended: 4GB\nCurrent: "
                f"{round(float(docker_info['MemTotal']) / calc_gb, 2)}"
            )
        if run:
            if type == "local":
                logger.info("Running Local Docker")
                if path == "":
                    raise ValueError(
                        "Please Provide Path to local docker-compose.yml file"
                    )
                start_time = time.time()
                subprocess.run(
                    f"docker compose -f {path} up --build -d",
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
                open("/tmp/docker-compose.yml", "wb").write(r.content)
                start_time = time.time()
                subprocess.run(
                    f"docker compose -f /tmp/docker-compose.yml up -d", shell=True
                )
                elapsed = time.time() - start_time
                logger.info(
                    f"Time took to get containers running: {str(timedelta(seconds=elapsed))}"
                )
        elif stop:
            for container in get_containers(client):
                logger.info(f"Stopping {container.name}")
                container.stop()
        elif clean:
            client.containers.prune()
            client.images.prune()
            client.volumes.prune()
            client.networks.prune()
    except Exception as err:
        logger.error(repr(err))


metadata.add_command(check)
