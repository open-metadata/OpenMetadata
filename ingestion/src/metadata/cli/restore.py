#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Restore utility for the metadata CLI
"""
import traceback

from sqlalchemy.engine import Engine
from tqdm import tqdm

from metadata.cli.utils import get_engine
from metadata.utils.helpers import BackupRestoreArgs
from metadata.utils.logger import ANSI, cli_logger, log_ansi_encoded_string

logger = cli_logger()


def execute_sql_file(engine: Engine, sql_file: str) -> None:
    """
    Method to create the connection and execute the sql query
    """

    with open(sql_file, encoding="utf-8") as file:
        failed_queries = 0
        all_queries = file.readlines()
        log_ansi_encoded_string(
            color=ANSI.GREEN,
            bold=False,
            message=f"Queries to process for restore: {len(all_queries)}",
        )

        for query in tqdm(all_queries):
            # `%` is a reserved syntax in SQLAlchemy to bind parameters. Escaping it with `%%`
            clean_query = query.replace("%", "%%")

            try:
                with engine.connect() as conn:
                    conn.execute(clean_query)

            except Exception as err:
                failed_queries += 1
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error processing the following query while restoring [{clean_query}] - {err}"
                )

        log_ansi_encoded_string(
            color=ANSI.GREEN,
            bold=False,
            message=f"Restore finished. {failed_queries} queries failed from {len(all_queries)}.",
        )


def run_restore(
    common_restore_obj_instance: BackupRestoreArgs,
    sql_file: str,
) -> None:
    """
    Run and restore the
    buckup. Optionally, download it from S3.

    :param common_restore_obj_instance: cls instance to fetch common args
    :param sql_file: local path of file to restore the backup
    """
    log_ansi_encoded_string(
        color=ANSI.BRIGHT_RED,
        bold=True,
        message="WARNING: restore is deprecated starting 1.4.0. Use database native tools to restore."
        "For more information, please visit: "
        "https://docs.open-metadata.org/v1.4.x/deployment/backup-restore-metadata",
    )
    log_ansi_encoded_string(
        color=ANSI.GREEN,
        bold=False,
        message="Restoring OpenMetadata backup for "
        f"{common_restore_obj_instance.host}:{common_restore_obj_instance.port}/{common_restore_obj_instance.database}",
    )

    engine = get_engine(common_args=common_restore_obj_instance)

    execute_sql_file(engine=engine, sql_file=sql_file)

    log_ansi_encoded_string(
        color=ANSI.GREEN,
        bold=False,
        message=f"Backup restored from {sql_file}",
    )
