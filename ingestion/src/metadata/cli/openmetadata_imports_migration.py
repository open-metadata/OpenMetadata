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
utility to update import for migration from v0.11.5 to 0.12
"""

import os

from metadata.utils.logger import cli_logger

logger = cli_logger()

V115_IMPORT_STRING = "from openmetadata."
V115_DAG_CONFIG_PATH = '"/airflow/dag_generated_configs/'
V12_IMPORT_STRING = "from openmetadata_managed_apis."
V12_DAG_CONFIG_PATH = '"/opt/airflow/dag_generated_configs/'


def run_openmetadata_imports_migration(
    dir_path: str, change_config_file_path: bool
) -> None:
    """Given a path to the DAG folder we'll look for openmetadata import and update the package to
    `openmetadata_managed_apis`

    Args:
        dir_path (str): path to the DAG folder
    """

    for root, _, filenames in os.walk(dir_path):
        filenames = [
            filename for filename in filenames if os.path.splitext(filename)[1] == ".py"
        ]
        logger.info(
            f"{len(filenames)} files found in `{root}`."
            "\nChecking for imports in the following files:\n\t{file_list}".format(
                file_list="\n\t".join(filenames)
            )
        )
        for filename in filenames:
            logger.info(f"Checking imports in {filename}")
            with open(os.path.join(root, filename), "r", encoding="utf-8") as dag_fle:
                orig_fle_data = dag_fle.read()

            fle_data = orig_fle_data  # We keep a copy of the original file data to see if any change was made

            if V115_IMPORT_STRING in fle_data:
                fle_data = fle_data.replace(V115_IMPORT_STRING, V12_IMPORT_STRING)
                logger.info(
                    f"Imports found in {filename}. Replaced `{V115_IMPORT_STRING}` with `{V12_IMPORT_STRING}`"
                )

            if change_config_file_path and V115_DAG_CONFIG_PATH in fle_data:
                fle_data = fle_data.replace(V115_DAG_CONFIG_PATH, V12_DAG_CONFIG_PATH)
                logger.info(
                    f"Old config path found. Replaced {V115_DAG_CONFIG_PATH} with {V12_DAG_CONFIG_PATH}."
                )

            if orig_fle_data != fle_data:
                with open(
                    os.path.join(root, filename), "w", encoding="utf-8"
                ) as dag_file:
                    dag_file.write(fle_data)
