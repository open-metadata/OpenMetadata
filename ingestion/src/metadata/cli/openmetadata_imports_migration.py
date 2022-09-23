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
V12_IMPORT_STRING = "from openmetadata_managed_apis."


def run_openmetadata_imports_migration(dir_path: str) -> None:
    """Given a path to the DAG folder we'll look for openmetadata import and update the package to
    `openmetadata_managed_apis`

    Args:
        dir_path (str): path to the DAG folder
    """

    if not os.path.isdir(dir_path):
        logger.error(f"{dir_path} is not a valid directory")
        raise ValueError

    for root, _, filenames in os.walk(dir_path):
        logger.info(
            f"{len(filenames)} files found in `{root}`."
            "\nChecking for imports in the following files:\n\t{file_list}".format(
                file_list="\n\t".join(filenames)
            )
        )
        for filename in filenames:
            logger.info(f"Checking imports in {filename}")
            if os.path.splitext(filename)[1] == ".py":
                with open(
                    os.path.join(root, filename), "r", encoding="utf-8"
                ) as dag_fle:
                    fle_data = dag_fle.read()

                if V115_IMPORT_STRING in fle_data:
                    fle_data = fle_data.replace(V115_IMPORT_STRING, V12_IMPORT_STRING)

                    with open(
                        os.path.join(root, filename), "w", encoding="utf-8"
                    ) as dag_file:
                        dag_file.write(fle_data)
                    logger.info(
                        f"Imports found in {filename}. Replaced `{V115_IMPORT_STRING}` with `{V12_IMPORT_STRING}`"
                    )
