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
utility to update dat config file for migration from v0.12.3 to 0.13
"""

import json
import os
from copy import deepcopy

from metadata.utils.logger import cli_logger

logger = cli_logger()


def run_openmetadata_dag_config_migration(dir_path: str, keep_backups: bool) -> None:
    """Update DAG config file by removing dbtConfig key and
    supportMetadataExtraction keys

    Args:
        dir_path (str): path directory defaults to `/opt/airflow/dag_generated_configs`
    """
    for root, _, files in os.walk(dir_path):
        filenames = [file_ for file_ in files if os.path.splitext(file_)[1] == ".json"]
        logger.info(
            f"{len(filenames)} files found in `{root}`."
            "\nChecking config. in the following files:\n\t{file_list}".format(
                file_list="\n\t".join(filenames)
            )
        )

        for filename in filenames:
            logger.info(f"Checking config. file: {filename}")
            with open(
                os.path.join(root, filename), "r", encoding="utf-8"
            ) as config_file:
                try:
                    orig_fle_data = json.loads(config_file.read())
                except json.JSONDecodeError:
                    logger.error(
                        f"Error decoding file {filename}. "
                        "The file will be skipped. You should verify if the file needs any update manually."
                    )
                    continue

            fle_data = deepcopy(
                orig_fle_data
            )  # We keep a copy of the original file data to see if any change was made

            try:
                fle_data["sourceConfig"]["config"]["dbtConfigSource"]
            except KeyError:
                logger.error(
                    f"Could not find the key `dbtConfigSource` in {filename}. Skipping key deletion."
                )
            else:
                del fle_data["sourceConfig"]["config"]["dbtConfigSource"]
                logger.info(f"Successfully removed key `dbtConfigSource` in {filename}")

            try:
                fle_data["openMetadataServerConnection"]["supportsMetadataExtraction"]
            except KeyError:
                logger.error(
                    f"Could not find the key `supportsMetadataExtraction` in {filename}. Skipping key deletion."
                )
            else:
                del fle_data["openMetadataServerConnection"][
                    "supportsMetadataExtraction"
                ]
                logger.info(
                    f"Successfully removed key `supportsMetadataExtraction` in {filename}"
                )

            try:
                fle_data["sourceConfig"]["config"]["markDeletedTablesFromFilterOnly"]
            except KeyError:
                logger.error(
                    f"Could not find the key `markDeletedTablesFromFilterOnly` in {filename}. Skipping key deletion."
                )
            else:
                del fle_data["sourceConfig"]["config"][
                    "markDeletedTablesFromFilterOnly"
                ]
                logger.info(
                    f"Successfully removed key `markDeletedTablesFromFilterOnly` in {filename}"
                )

            if orig_fle_data != fle_data:
                with open(
                    os.path.join(root, filename), "w", encoding="utf-8"
                ) as config_file:
                    config_file.write(json.dumps(fle_data))
                logger.info(f"File {filename} successfuly updated")

                if keep_backups:
                    with open(
                        os.path.join(root, f"{filename}.bak"), "w", encoding="utf-8"
                    ) as bak_config_file:
                        bak_config_file.write(json.dumps(orig_fle_data))
                        logger.info(f"Backup File {filename}.bak successfuly updated")
