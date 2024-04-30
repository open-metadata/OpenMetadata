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
This module defines the CLI commands for OpenMetadata
"""
import argparse
import logging
from enum import Enum
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from metadata.__version__ import get_metadata_version
from metadata.cli.app import run_app
from metadata.cli.backup import UploadDestinationType, run_backup
from metadata.cli.dataquality import run_test
from metadata.cli.ingest import run_ingest
from metadata.cli.insight import run_insight
from metadata.cli.lineage import run_lineage
from metadata.cli.profile import run_profiler
from metadata.cli.restore import run_restore
from metadata.cli.usage import run_usage
from metadata.utils.helpers import BackupRestoreArgs
from metadata.utils.logger import cli_logger, set_loggers_level

logger = cli_logger()


class MetadataCommands(Enum):
    INGEST = "ingest"
    USAGE = "usage"
    PROFILE = "profile"
    TEST = "test"
    BACKUP = "backup"
    RESTORE = "restore"
    WEBHOOK = "webhook"
    INSIGHT = "insight"
    LINEAGE = "lineage"
    APP = "app"


RUN_PATH_METHODS = {
    MetadataCommands.INGEST.value: run_ingest,
    MetadataCommands.USAGE.value: run_usage,
    MetadataCommands.LINEAGE.value: run_lineage,
    MetadataCommands.INSIGHT.value: run_insight,
    MetadataCommands.PROFILE.value: run_profiler,
    MetadataCommands.TEST.value: run_test,
    MetadataCommands.APP.value: run_app,
}


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
        type=Path,
        required=True,
    )


def webhook_args(parser: argparse.ArgumentParser):
    """
    Additional Parser Arguments for Webhook
    """
    parser.add_argument(
        "-H", "--host", help="Webserver Host", type=str, default="0.0.0.0"
    )
    parser.add_argument("-p", "--port", help="Webserver Port", type=int, default=8000)


def backup_args(parser: argparse.ArgumentParser):
    """
    Additional Parser Arguments for Backup
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
        type=Path,
        default=None,
    )
    parser.add_argument(
        "--filename",
        help="Filename to store the backup",
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
    Additional Parser Arguments for Restore
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
        type=Path,
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
    Additional Parser Arguments for Metadata
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
        sub_parser.add_parser(MetadataCommands.LINEAGE.value, help="Lineage Workflow")
    )
    create_common_config_parser_args(
        sub_parser.add_parser(
            MetadataCommands.USAGE.value,
            help="Workflow to check the query logs of a database service.",
        )
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
    create_common_config_parser_args(
        sub_parser.add_parser(
            MetadataCommands.APP.value,
            help="Workflow for running external applications",
        )
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
    create_common_config_parser_args(
        sub_parser.add_parser(
            MetadataCommands.INSIGHT.value, help="Data Insights Workflow"
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
    path = None
    if config_file:
        path = Path(config_file).expanduser()
    if contains_args.get("debug"):
        set_loggers_level(logging.DEBUG)
    elif contains_args.get("log_level"):
        set_loggers_level(contains_args.get("log_level"))
    else:
        set_loggers_level(logging.INFO)

    if metadata_workflow in RUN_PATH_METHODS:
        RUN_PATH_METHODS[metadata_workflow](path)

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
            filename=contains_args.get("filename"),
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
