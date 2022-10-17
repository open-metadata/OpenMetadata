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
import argparse
import logging
import pathlib
from http.server import BaseHTTPRequestHandler, HTTPServer

from metadata.__version__ import get_metadata_version
from metadata.cli.backup import UploadDestinationType,run_backup
from metadata.cli.dataquality import run_test
from metadata.cli.docker import BACKEND_DATABASES, run_docker
from metadata.cli.ingest import run_ingest
from metadata.cli.openmetadata_imports_migration import (
    run_openmetadata_imports_migration,
)
from metadata.cli.profile import run_profiler
from metadata.cli.restore import run_restore
from metadata.utils.logger import cli_logger, set_loggers_level

logger = cli_logger()

OM_IMPORTS_MIGRATION = """
    Update DAG files generated after creating workflow in 0.11 and before.
    In 0.12 the airflow managed API package name changed from `openmetadata` to `openmetadata_managed_apis`
    hence breaking existing DAGs. The `dag_generated_config` folder also changed location in Docker.
    This small CLI utility allows you to update both elements.
    """

BACKUP_HELP = """
    Run a backup for the metadata DB. Uses a custom dump strategy for OpenMetadata tables.

    We can pass as many connection options as required with `-o <opt1>, -o <opt2> [...]`
    Same with connection arguments `-a <arg1>, -a <arg2> [...]`

    To run the upload, provide the information as
    `--upload endpoint bucket key` and properly configure the environment
    variables AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY.

    If `-s` or `--schema` is provided, we will trigger a Postgres backup instead
    of a MySQL backup. This is the value of the schema containing the OpenMetadata
    tables."""
RESTORE_HELP = """
    Run a restore for the metadata DB.

    We can pass as many connection options as required with `-o <opt1>, -o <opt2> [...]`
    Same with connection arguments `-a <arg1>, -a <arg2> [...]`

    If `-s` or `--schema` is provided, we will trigger a Postgres Restore instead
    of a MySQL restore. This is the value of the schema containing the OpenMetadata
    tables.
    """


def create_common_config_parser_args(parser: argparse.ArgumentParser):
    parser.add_argument(
        "-c",
        "--config",
        help="path to the config file",
        type=pathlib.Path,
        required=True,
    )


def create_openmetadata_imports_migration_args(parser: argparse.ArgumentParser):
    parser.add_argument(
        "-d",
        "--dir-path",
        default="/opt/airflow/dags",
        type=pathlib.Path,
        help="Path to the DAG folder. Default to `/opt/airflow/dags`",
    )

    parser.add_argument(
        "--change-config-file-path",
        help="Flag option. If pass this will try to change the path of the dag config files",
        type=bool,
    )


def docker_args(parser: argparse.ArgumentParser):
    """
    Addtional Parser Arguments for Docker
    """
    parser.add_argument(
        "--start", help="Start release docker containers", default=True, type=bool
    )
    parser.add_argument(
        "--stop",
        help="Stops openmetadata docker containers",
        default=True,
        type=bool,
    )
    parser.add_argument(
        "--pause", help="Pause openmetadata docker containers", default=True, type=bool
    )
    parser.add_argument(
        "--resume",
        help="Resume/Unpause openmetadata docker containers",
        default=True,
        type=bool,
    )
    parser.add_argument(
        "--clean",
        help="Stops and remove openmetadata docker containers along with images, volumes, networks associated",
        default=True,
        type=bool,
    )
    parser.add_argument(
        "-f",
        "--file-path",
        help="Path to Local docker-compose.yml",
        type=pathlib.Path,
        required=False,
    )
    parser.add_argument(
        "-env-file",
        "--env-file-path",
        help="Path to env file containing the environment variables",
        type=pathlib.Path,
        required=False,
    )
    parser.add_argument(
        "--reset-db", help="Reset OpenMetadata Data", type=bool, default=True
    )
    parser.add_argument(
        "--ingest-sample-data",
        help="Enable the sample metadata ingestion",
        type=bool,
        default=True,
    )
    parser.add_argument(
        "-db",
        "--database",
        choices=list(BACKEND_DATABASES.keys()),
        default="mysql",
    )


def webhook_args(parser: argparse.ArgumentParser):
    """
    Addtional Parser Arguments for Webhook
    """
    parser.add_argument(
        "-H", "--host", help="Webserver Host", type=str, default="0.0.0.0"
    )
    parser.add_argument("-p", "--port", help="Webserver Port", type=int, default=8000)


def backup_args(parser: argparse.ArgumentParser):
    """
    Addtional Parser Arguments for Backup
    """
    parser.add_argument(
        "-H", "--host", help="Host that runs the database", required=True
    )
    parser.add_argument(
        "-u",
        "--user",
        help="User to run the backup",
        required=True,
    )
    parser.add_argument(
        "-p",
        "--password",
        help="Credentials for the user",
        required=True,
    )
    parser.add_argument(
        "-d",
        "--database",
        help="Database to backup",
        required=True,
    )
    parser.add_argument(
        "--port",
        help="Database service port",
        default="3306",
        required=False,
    )
    parser.add_argument(
        "--output",
        help="Local path to store the backup",
        type=pathlib.Path,
        default=None,
    )
    parser.add_argument(
        "--upload",
        help="S3 endpoint, bucket & key to upload the backup file",
        nargs=3,
        default=None,
    )
    parser.add_argument("-o", "--options", default=None, action="append")
    parser.add_argument("-a", "--arguments", default=None, action="append")
    parser.add_argument(
        "-s",
        "--schema",
        default=None,
        required=False,
    )


def restore_args(parser: argparse.ArgumentParser):
    """
    Addtional Parser Arguments for Restore
    """
    parser.add_argument(
        "-H",
        "--host",
        help="Host that runs the database",
        required=True,
    )
    parser.add_argument(
        "-u",
        "--user",
        help="User to run the restore backup",
        required=True,
    )

    parser.add_argument(
        "-p",
        "--password",
        help="Credentials for the user",
        required=True,
    )

    parser.add_argument(
        "-d",
        "--database",
        help="Database to restore",
        required=True,
    )

    parser.add_argument(
        "--port",
        help="Database service port",
        default="3306",
        required=False,
    )

    parser.add_argument(
        "--input",
        help="Local backup file path for restore",
        type=pathlib.Path,
        default=None,
    )

    parser.add_argument("-o", "--options", default=None, action="append")

    parser.add_argument("-a", "--arguments", default=None, action="append")

    parser.add_argument(
        "-s",
        "--schema",
        default=None,
        required=False,
    )


def add_metadata_args(parser: argparse.ArgumentParser):
    """
    Addtional Parser Arguments for Metadata
    """
    parser.add_argument(
        "-v", "--version", action="version", version=get_metadata_version()
    )

    parser.add_argument(
        "-l",
        "--log-level",
        choices=["INFO", "DEBUG", "WARNING", "ERROR", "CRITICAL"],
        help="Set Log Level",
    )


def metadata():
    """
    This method implements parsing of the arguments passed from CLI
    """
    parser = argparse.ArgumentParser(prog="metadata", description="Ingestion Framework")
    sub_parser = parser.add_subparsers(dest="command")

    create_common_config_parser_args(
        sub_parser.add_parser("ingest", help="Ingestion Workflow", prog="ingest")
    )
    create_common_config_parser_args(
        sub_parser.add_parser(
            "profile", help="Workflow for profiling Table sources into Metadata"
        )
    )
    create_common_config_parser_args(
        sub_parser.add_parser("test", help="Workflow for running test suites")
    )

    create_openmetadata_imports_migration_args(
        sub_parser.add_parser(
            "openmetadata_imports_migration",
            help=OM_IMPORTS_MIGRATION,
        )
    )
    docker_args(sub_parser.add_parser("docker", help="Docker Quickstart"))
    backup_args(
        sub_parser.add_parser(
            "backup",
            help=BACKUP_HELP,
        )
    )
    restore_args(
        sub_parser.add_parser(
            "restore",
            help=RESTORE_HELP,
        )
    )
    webhook_args(
        sub_parser.add_parser(
            "webhook", help="Simple Webserver to test webhook metadata events"
        )
    )

    add_metadata_args(parser)
    parser.add_argument("--debug", help="Debug Mode", action="store_true")

    contains_args = vars(parser.parse_args())
    metadata_workflow = contains_args.get("command")
    config_file = contains_args.get("config")
    if contains_args.get("debug"):
        set_loggers_level(logging.DEBUG)
    elif contains_args.get("log_level"):
        set_loggers_level(contains_args.get("log_level"))
    else:
        set_loggers_level(logging.INFO)

    if metadata_workflow == "ingest":
        run_ingest(config_path=config_file)
    elif metadata_workflow == "profile":
        run_profiler(config_path=config_file)
    elif metadata_workflow == "test":
        run_test(config_path=config_file)
    elif metadata_workflow == "backup":
        run_backup(
            contains_args.get("host"),
            contains_args.get("user"),
            contains_args.get("password"),
            contains_args.get("database"),
            contains_args.get("port"),
            contains_args.get("output"),
            contains_args.get("upload_destination_type"),
            contains_args.get("upload"),
            contains_args.get("options"),
            contains_args.get("arguments"),
            contains_args.get("schema"),
        )
    elif metadata_workflow == "restore":
        run_restore(
            contains_args.get("host"),
            contains_args.get("user"),
            contains_args.get("password"),
            contains_args.get("database"),
            contains_args.get("port"),
            contains_args.get("input"),
            contains_args.get("options"),
            contains_args.get("arguments"),
            contains_args.get("schema"),
        )
    elif metadata_workflow == "docker":
        run_docker(
            contains_args.get("start"),
            contains_args.get("stop"),
            contains_args.get("pause"),
            contains_args.get("resume"),
            contains_args.get("clean"),
            contains_args.get("file_path"),
            contains_args.get("env_file_path"),
            contains_args.get("reset_db"),
            contains_args.get("ingest_sample_data"),
            contains_args.get("database"),
        )
    elif metadata_workflow == "webhook":

        class WebhookHandler(BaseHTTPRequestHandler):
            def do_GET(self):  # pylint: disable=invalid-name
                self.send_response(200)
                self.send_header("Content-type", "text/html")
                self.end_headers()
                self.wfile.write(bytes("Hello, World! Here is a GET response", "utf8"))

            def do_POST(self):  # pylint: disable=invalid-name
                content_len = int(self.headers.get("Content-Length"))
                self.rfile.read(content_len)
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                logger.info(self.rfile.read(content_len))

        logger.info(
            f"Starting server at {contains_args.get('host')}:{contains_args.get('port')}"
        )
        with HTTPServer(
            (contains_args.get("host"), contains_args.get("port")), WebhookHandler
        ) as server:
            server.serve_forever()

    elif metadata_workflow == "openmetadata_imports_migration":
        run_openmetadata_imports_migration(
            contains_args.get("dir_path"), contains_args.get("change_config_file_path")
        )


# "--upload_destination_type",
#     help="AWS or AZURE",
#     type=UploadDestinationType,
#     default=None,
