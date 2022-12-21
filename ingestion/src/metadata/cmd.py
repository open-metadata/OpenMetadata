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
from enum import Enum
from http.server import BaseHTTPRequestHandler, HTTPServer

from metadata.__version__ import get_metadata_version
from metadata.cli.backup import UploadDestinationType, run_backup
from metadata.cli.dataquality import run_test
from metadata.cli.docker import BACKEND_DATABASES, DockerActions, run_docker
from metadata.cli.ingest import run_ingest
from metadata.cli.openmetadata_dag_config_migration import (
    run_openmetadata_dag_config_migration,
)
from metadata.cli.openmetadata_imports_migration import (
    run_openmetadata_imports_migration,
)
from metadata.cli.profile import run_profiler
from metadata.cli.restore import run_restore
from metadata.utils.helpers import BackupRestoreArgs
from metadata.utils.logger import cli_logger, set_loggers_level

logger = cli_logger()


class MetadataCommands(Enum):
    INGEST = "ingest"
    PROFILE = "profile"
    TEST = "test"
    DOCKER = "docker"
    BACKUP = "backup"
    RESTORE = "restore"
    WEBHOOK = "webhook"
    OPENMETADATA_IMPORTS_MIGRATION = "openmetadata_imports_migration"
    OPENMETADATA_DAG_CONFIG_MIGRATION = "openmetadata_dag_config_migration"


OM_IMPORTS_MIGRATION = """
    Update DAG files generated after creating workflow in 0.11 and before.
    In 0.12 the airflow managed API package name changed from `openmetadata` to 
    `openmetadata_managed_apis` hence breaking existing DAGs. 
    The `dag_generated_config` folder also changed location in Docker.
    This small CLI utility allows you to update both elements.
    """

OM_DAG_CONFIG_MIGRATION = """
    Update DAG Config files generated after creating workflow in 0.12 and before.
    In 0.13 certains keys of the dag config. files have been removed. This small
    utility command allows you to update legacy dag config files. Note this can
    also be done manually through the UI by clicking on `redeploy`
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
    tables.
    """
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


def create_openmetadata_dag_config_migration_args(parser: argparse.ArgumentParser):
    parser.add_argument(
        "-d",
        "--dir-path",
        default="/opt/airflow/dag_generated_configs",
        type=pathlib.Path,
        help="Path to the DAG folder. Default to `/opt/airflow/dag_generated_configs`",
    )

    parser.add_argument(
        "--keep-backups",
        help="Flag option. If passed, old files will be kept as backups <filename>.json.bak",
        action="store_true",
    )


def docker_args(parser: argparse.ArgumentParser):
    """
    Addtional Parser Arguments for Docker
    """
    parser.add_argument(
        "--start", help="Start release docker containers", action="store_true"
    )
    parser.add_argument(
        "--stop", help="Stops openmetadata docker containers", action="store_true"
    )
    parser.add_argument(
        "--pause", help="Pause openmetadata docker containers", action="store_true"
    )
    parser.add_argument(
        "--resume",
        help="Resume/Unpause openmetadata docker containers",
        action="store_true",
    )
    parser.add_argument(
        "--clean",
        help="Stops and remove openmetadata docker containers along with images, volumes, networks associated",
        action="store_true",
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
        "--reset-db", help="Reset OpenMetadata Data", action="store_true"
    )
    parser.add_argument(
        "--ingest-sample-data",
        help="Enable the sample metadata ingestion",
        action="store_true",
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
    )
    parser.add_argument(
        "--output",
        help="Local path to store the backup",
        type=pathlib.Path,
        default=None,
    )
    parser.add_argument(
        "--upload-destination-type",
        help="AWS or AZURE",
        choices=UploadDestinationType.__members__,
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
        required=True,
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


def get_parser(args=None):
    """
    Parser method that returns parsed_args
    """
    parser = argparse.ArgumentParser(prog="metadata", description="Ingestion Framework")
    sub_parser = parser.add_subparsers(dest="command")

    create_common_config_parser_args(
        sub_parser.add_parser(MetadataCommands.INGEST.value, help="Ingestion Workflow")
    )
    create_common_config_parser_args(
        sub_parser.add_parser(
            MetadataCommands.PROFILE.value,
            help="Workflow for profiling Table sources into Metadata",
        )
    )
    create_common_config_parser_args(
        sub_parser.add_parser(
            MetadataCommands.TEST.value, help="Workflow for running test suites"
        )
    )
    create_openmetadata_imports_migration_args(
        sub_parser.add_parser(
            MetadataCommands.OPENMETADATA_IMPORTS_MIGRATION.value,
            help=OM_IMPORTS_MIGRATION,
        )
    )
    create_openmetadata_dag_config_migration_args(
        sub_parser.add_parser(
            MetadataCommands.OPENMETADATA_DAG_CONFIG_MIGRATION.value,
            help=OM_DAG_CONFIG_MIGRATION,
        )
    )
    docker_args(
        sub_parser.add_parser(MetadataCommands.DOCKER.value, help="Docker Quickstart")
    )
    backup_args(
        sub_parser.add_parser(
            MetadataCommands.BACKUP.value,
            help=BACKUP_HELP,
        )
    )
    restore_args(
        sub_parser.add_parser(
            MetadataCommands.RESTORE.value,
            help=RESTORE_HELP,
        )
    )
    webhook_args(
        sub_parser.add_parser(
            MetadataCommands.WEBHOOK.value,
            help="Simple Webserver to test webhook metadata events",
        )
    )

    add_metadata_args(parser)
    parser.add_argument("--debug", help="Debug Mode", action="store_true")
    return parser.parse_args(args)


def metadata(args=None):
    """
    This method implements parsing of the arguments passed from CLI
    """
    contains_args = vars(get_parser(args))
    metadata_workflow = contains_args.get("command")
    config_file = contains_args.get("config")
    if contains_args.get("debug"):
        set_loggers_level(logging.DEBUG)
    elif contains_args.get("log_level"):
        set_loggers_level(contains_args.get("log_level"))
    else:
        set_loggers_level(logging.INFO)

    if metadata_workflow == MetadataCommands.INGEST.value:
        run_ingest(config_path=config_file)
    if metadata_workflow == MetadataCommands.PROFILE.value:
        run_profiler(config_path=config_file)
    if metadata_workflow == MetadataCommands.TEST.value:
        run_test(config_path=config_file)
    if metadata_workflow == MetadataCommands.BACKUP.value:
        run_backup(
            common_backup_obj_instance=BackupRestoreArgs(
                host=contains_args.get("host"),
                user=contains_args.get("user"),
                password=contains_args.get("password"),
                database=contains_args.get("database"),
                port=contains_args.get("port"),
                options=contains_args.get("options"),
                arguments=contains_args.get("arguments"),
                schema=contains_args.get("schema"),
            ),
            output=contains_args.get("output"),
            upload_destination_type=contains_args.get("upload_destination_type"),
            upload=contains_args.get("upload"),
        )
    if metadata_workflow == MetadataCommands.RESTORE.value:
        run_restore(
            common_restore_obj_instance=BackupRestoreArgs(
                host=contains_args.get("host"),
                user=contains_args.get("user"),
                password=contains_args.get("password"),
                database=contains_args.get("database"),
                port=contains_args.get("port"),
                options=contains_args.get("options"),
                arguments=contains_args.get("arguments"),
                schema=contains_args.get("schema"),
            ),
            sql_file=contains_args.get("input"),
        )
    if metadata_workflow == MetadataCommands.DOCKER.value:
        run_docker(
            docker_obj_instance=DockerActions(
                start=contains_args.get("start"),
                stop=contains_args.get("stop"),
                pause=contains_args.get("pause"),
                resume=contains_args.get("resume"),
                clean=contains_args.get("clean"),
                reset_db=contains_args.get("reset_db"),
            ),
            file_path=contains_args.get("file_path"),
            env_file_path=contains_args.get("env_file_path"),
            ingest_sample_data=contains_args.get("ingest_sample_data"),
            database=contains_args.get("database"),
        )
    if metadata_workflow == MetadataCommands.WEBHOOK.value:

        class WebhookHandler(BaseHTTPRequestHandler):
            def do_GET(self):  # pylint: disable=invalid-name
                self.send_response(200)
                self.send_header("Content-type", "text/html")
                self.end_headers()
                self.wfile.write(bytes("Hello, World! Here is a GET response", "utf8"))

            def do_POST(self):  # pylint: disable=invalid-name
                content_len = int(self.headers.get("Content-Length"))
                post_body = self.rfile.read(content_len)
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.end_headers()
                logger.info(post_body)

        logger.info(
            f"Starting server at {contains_args.get('host')}:{contains_args.get('port')}"
        )
        with HTTPServer(
            (contains_args.get("host"), contains_args.get("port")), WebhookHandler
        ) as server:
            server.serve_forever()

    if metadata_workflow == MetadataCommands.OPENMETADATA_IMPORTS_MIGRATION.value:
        run_openmetadata_imports_migration(
            contains_args.get("dir_path"), contains_args.get("change_config_file_path")
        )

    if metadata_workflow == MetadataCommands.OPENMETADATA_DAG_CONFIG_MIGRATION.value:
        run_openmetadata_dag_config_migration(
            contains_args.get("dir_path"), contains_args.get("keep_backups")
        )
