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

import logging
import os
import pathlib
import sys
from typing import List, Optional, Tuple

import click
from pydantic import ValidationError

from metadata.__version__ import get_metadata_version
from metadata.cli.backup import run_backup
from metadata.cli.docker import run_docker
from metadata.config.common import load_config_file
from metadata.ingestion.api.workflow import Workflow
from metadata.orm_profiler.api.workflow import ProfilerWorkflow
from metadata.profiler.profiler_runner import ProfilerRunner

logger = logging.getLogger(__name__)

logging.getLogger("urllib3").setLevel(logging.WARN)
# Configure logger.
BASE_LOGGING_FORMAT = (
    "[%(asctime)s] %(levelname)-8s {%(name)s:%(lineno)d} - %(message)s"
)
logging.basicConfig(format=BASE_LOGGING_FORMAT)


@click.group()
def check() -> None:
    pass


@click.group()
@click.version_option(get_metadata_version())
@click.option(
    "--debug/--no-debug", default=lambda: os.environ.get("METADATA_DEBUG", False)
)
@click.option(
    "--log-level",
    "-l",
    type=click.Choice(["INFO", "DEBUG", "WARNING", "ERROR", "CRITICAL"]),
    help="Log level",
    required=False,
)
def metadata(debug: bool, log_level: str) -> None:
    if debug:
        logging.getLogger().setLevel(logging.INFO)
        logging.getLogger("metadata").setLevel(logging.DEBUG)
    elif log_level:
        logging.getLogger().setLevel(log_level)
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
        logger.debug(f"Using config: {workflow_config}")
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
    help="Profiler and Testing Workflow config",
    required=True,
)
def profile(config: str) -> None:
    """Main command for profiling and testing Table sources into Metadata"""
    config_file = pathlib.Path(config)
    workflow_config = load_config_file(config_file)

    try:
        logger.debug(f"Using config: {workflow_config}")
        workflow = ProfilerWorkflow.create(workflow_config)
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


@metadata.command()
@click.option(
    "-c",
    "--config",
    type=click.Path(exists=True, dir_okay=False),
    help="Profiler config",
    required=True,
)
def profiler(config: str) -> None:
    """Main command for running data openmetadata and tests"""
    try:
        config_file = pathlib.Path(config)
        profiler_config = load_config_file(config_file)
        try:
            logger.info(f"Using config: {profiler_config}")
            profiler_runner = ProfilerRunner.create(profiler_config)
        except ValidationError as e:
            click.echo(e, err=True)
            sys.exit(1)

        logger.info(f"Running Profiler for  {profiler_runner.config.profiler.type} ...")
        profile_results = profiler_runner.run_profiler()
        logger.info(f"Profiler Results")
        logger.info(f"{profile_results}")

    except Exception as e:
        logger.exception(f"Scan failed: {str(e)}")
        logger.info(f"Exiting with code 1")


@metadata.command()
@click.option("--start", help="Start release docker containers", is_flag=True)
@click.option(
    "--stop",
    help="Stops openmetadata docker containers",
    is_flag=True,
)
@click.option("--pause", help="Pause openmetadata docker containers", is_flag=True)
@click.option(
    "--resume", help="Resume/Unpause openmetadata docker containers", is_flag=True
)
@click.option(
    "--clean",
    help="Stops and remove openmetadata docker containers along with images, volumes, networks associated",
    is_flag=True,
)
@click.option(
    "-f",
    "--file-path",
    help="Path to Local docker-compose.yml",
    type=click.Path(exists=True, dir_okay=False),
    required=False,
)
def docker(start, stop, pause, resume, clean, file_path) -> None:
    """
    Checks Docker Memory Allocation
    Run Latest Release Docker - metadata docker --start
    Run Local Docker - metadata docker --start -f path/to/docker-compose.yml
    """
    run_docker(start, stop, pause, resume, clean, file_path)


@metadata.command()
@click.option(
    "-h",
    "--host",
    help="Host that runs the database",
    required=True,
)
@click.option(
    "-u",
    "--user",
    help="User to run the backup",
    required=True,
)
@click.option(
    "-p",
    "--password",
    help="Credentials for the user",
    required=True,
)
@click.option(
    "-d",
    "--database",
    help="Database to backup",
    required=True,
)
@click.option(
    "--port",
    help="Database service port",
    default="3306",
    required=False,
)
@click.option(
    "--output",
    help="Local path to store the backup",
    type=click.Path(exists=False, dir_okay=True),
    default=None,
    required=False,
)
@click.option(
    "--upload",
    help="S3 endpoint, bucket & key to upload the backup file",
    nargs=3,
    type=click.Tuple([str, str, str]),
    default=None,
    required=False,
)
@click.option(
    "-o", "--options", multiple=True, default=["--protocol=tcp", "--no-tablespaces"]
)
def backup(
    host: str,
    user: str,
    password: str,
    database: str,
    port: str,
    output: Optional[str],
    upload: Optional[Tuple[str, str, str]],
    options: List[str],
) -> None:
    """
    Run a backup for the metadata DB.
    Requires mysqldump installed on the host.

    We can pass as many options as required with `-o <opt1>, -o <opt2> [...]`

    To run the upload, provide the information as
    `--upload endpoint bucket key` and properly configure the environment
    variables AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY
    """
    run_backup(host, user, password, database, port, output, upload, options)


metadata.add_command(check)
