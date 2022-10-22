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
This module defines the CLI commands for OpenMetada
"""

import logging
import os
import pathlib
import sys
import traceback
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import List, Optional, Tuple

import click

from metadata.__version__ import get_metadata_version
from metadata.cli.backup import run_backup
from metadata.cli.docker import BACKEND_DATABASES, run_docker
from metadata.cli.ingest import run_ingest
from metadata.cli.openmetadata_imports_migration import (
    run_openmetadata_imports_migration,
)
from metadata.cli.restore import run_restore
from metadata.config.common import load_config_file
from metadata.orm_profiler.api.workflow import ProfilerWorkflow
from metadata.test_suite.api.workflow import TestSuiteWorkflow
from metadata.utils.logger import cli_logger, set_loggers_level
from metadata.utils.workflow_output_handler import WorkflowType, print_init_error

logger = cli_logger()


# To be fixed in https://github.com/open-metadata/OpenMetadata/issues/8081
# pylint: disable=too-many-arguments
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
    """Method to set logger information"""
    if debug:
        set_loggers_level(logging.DEBUG)
    elif log_level:
        set_loggers_level(log_level)
    else:
        set_loggers_level(logging.INFO)


@metadata.command()
@click.option(
    "-c",
    "--config",
    type=click.Path(exists=True, dir_okay=False),
    help="Workflow config",
    required=True,
)
def ingest(config: str) -> None:
    """
    Main command for ingesting metadata into Metadata.
    Logging is controlled via the JSON config
    """
    run_ingest(config_path=config)


@metadata.command()
@click.option(
    "-c",
    "--config",
    type=click.Path(exists=True, dir_okay=False),
    help="Test Suite Workflow config",
    required=True,
)
def test(config: str) -> None:
    """Main command for running test suites"""
    config_file = pathlib.Path(config)
    workflow_test_config_dict = None
    try:
        workflow_test_config_dict = load_config_file(config_file)
        logger.debug(f"Using config: {workflow_test_config_dict}")
        workflow = TestSuiteWorkflow.create(workflow_test_config_dict)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        print_init_error(exc, workflow_test_config_dict, WorkflowType.PROFILE)
        sys.exit(1)

    workflow.execute()
    workflow.stop()
    workflow.print_status()
    ret = workflow.result_status()
    sys.exit(ret)


@metadata.command()
@click.option(
    "-c",
    "--config",
    type=click.Path(exists=True, dir_okay=False),
    help="Profiler Workflow config",
    required=True,
)
def profile(config: str) -> None:
    """Main command for profiling Table sources into Metadata"""
    config_file = pathlib.Path(config)
    workflow_config_dict = None
    try:
        workflow_config_dict = load_config_file(config_file)
        logger.debug(f"Using config: {workflow_config_dict}")
        workflow = ProfilerWorkflow.create(workflow_config_dict)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        print_init_error(exc, workflow_config_dict, WorkflowType.PROFILE)
        sys.exit(1)

    workflow.execute()
    workflow.stop()
    workflow.print_status()
    ret = workflow.result_status()
    sys.exit(ret)


@metadata.command()
@click.option("-h", "--host", help="Webserver Host", type=str, default="0.0.0.0")
@click.option("-p", "--port", help="Webserver Port", type=int, default=8000)
def webhook(host: str, port: int) -> None:
    """Simple Webserver to test webhook metadata events"""

    class WebhookHandler(BaseHTTPRequestHandler):
        """WebhookHandler class to define the rest API methods"""

        # Overwrite do_GET and do_POST from parent class
        def do_GET(self):  # pylint: disable=invalid-name
            """WebhookHandler GET API method"""
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()

            message = "Hello, World! Here is a GET response"
            self.wfile.write(bytes(message, "utf8"))

        def do_POST(self):  # pylint: disable=invalid-name
            """WebhookHandler POST API method"""
            content_len = int(self.headers.get("Content-Length"))
            post_body = self.rfile.read(content_len)
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            logger.info(post_body)

    logger.info(f"Starting server at {host}:{port}")
    with HTTPServer((host, port), WebhookHandler) as server:
        server.serve_forever()


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
@click.option(
    "-env-file",
    "--env-file-path",
    help="Path to env file containing the environment variables",
    type=click.Path(exists=True, dir_okay=False),
    required=False,
)
@click.option("--reset-db", help="Reset OpenMetadata Data", is_flag=True)
@click.option(
    "--ingest-sample-data", help="Enable the sample metadata ingestion", is_flag=True
)
@click.option(
    "-db",
    "--database",
    type=click.Choice(list(BACKEND_DATABASES.keys())),
    default="mysql",
)
def docker(
    start,
    stop,
    pause,
    resume,
    clean,
    file_path,
    env_file_path,
    reset_db,
    ingest_sample_data,
    database,
) -> None:
    """
    Checks Docker Memory Allocation
    Run Latest Release Docker - metadata docker --start
    Run Local Docker - metadata docker --start -f path/to/docker-compose.yml
    """
    run_docker(
        start,
        stop,
        pause,
        resume,
        clean,
        file_path,
        env_file_path,
        reset_db,
        ingest_sample_data,
        database,
    )


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
    default=None,
    required=False,
)
@click.option(
    "-o",
    "--options",
    multiple=True,
    default=None,
)
@click.option(
    "-a",
    "--arguments",
    multiple=True,
    default=None,
)
@click.option(
    "-s",
    "--schema",
    default=None,
    required=False,
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
    arguments: List[str],
    schema: str,
) -> None:
    """
    Run a backup for the metadata DB. Uses a custom dump strategy for OpenMetadata tables.

    We can pass as many connection options as required with `-o <opt1>, -o <opt2> [...]`
    Same with connection arguments `-a <arg1>, -a <arg2> [...]`

    To run the upload, provide the information as
    `--upload endpoint bucket key` and properly configure the environment
    variables AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY.

    If `-s` or `--schema` is provided, we will trigger a Postgres backup instead
    of a MySQL backup. This is the value of the schema containing the OpenMetadata
    tables.
    """
    run_backup(
        host, user, password, database, port, output, upload, options, arguments, schema
    )


@metadata.command()
@click.option(
    "-d",
    "--dir-path",
    default="/opt/airflow/dags",
    type=click.Path(exists=True, dir_okay=True),
    help="Path to the DAG folder. Default to `/opt/airflow/dags`",
)
@click.option(
    "--change-config-file-path",
    is_flag=True,
    help="Flag option. If pass this will try to change the path of the dag config files",
)
def openmetadata_imports_migration(
    dir_path: str,
    change_config_file_path: bool,
) -> None:
    """Update DAG files generated after creating workflow in 0.11 and before.

    In 0.12 the airflow managed API package name changed from `openmetadata` to `openmetadata_managed_apis`
    hence breaking existing DAGs. The `dag_generated_config` folder also changed location in Docker.
    This small CLI utility allows you to update both elements.
    """
    run_openmetadata_imports_migration(dir_path, change_config_file_path)


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
    help="User to run the restore backup",
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
    help="Database to restore",
    required=True,
)
@click.option(
    "--port",
    help="Database service port",
    default="3306",
    required=False,
)
@click.option(
    "-b",
    "--backup-file",
    type=click.Path(exists=True, dir_okay=False),
    help="Backup file",
    required=True,
)
@click.option(
    "-o",
    "--options",
    multiple=True,
    default=None,
)
@click.option(
    "-a",
    "--arguments",
    multiple=True,
    default=None,
)
@click.option(
    "-s",
    "--schema",
    default=None,
    required=False,
)
def restore(
    host: str,
    user: str,
    password: str,
    database: str,
    port: str,
    backup_file: str,
    options: List[str],
    arguments: List[str],
    schema: str,
) -> None:
    """
    Run a restore for the metadata DB.

    We can pass as many connection options as required with `-o <opt1>, -o <opt2> [...]`
    Same with connection arguments `-a <arg1>, -a <arg2> [...]`

    If `-s` or `--schema` is provided, we will trigger a Postgres Restore instead
    of a MySQL restore. This is the value of the schema containing the OpenMetadata
    tables.
    """
    run_restore(
        host,
        user,
        password,
        database,
        port,
        backup_file,
        options,
        arguments,
        schema,
    )


metadata.add_command(check)
