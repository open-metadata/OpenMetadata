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
Profiler utility for the metadata CLI
"""
import sys
import traceback
from pathlib import Path

from metadata.config.common import load_config_file
from metadata.utils.logger import cli_logger
from metadata.workflow.application import ApplicationWorkflow

logger = cli_logger()


def run_app(config_path: Path) -> None:
    """
    Run the application workflow from a config path
    to a JSON or YAML file
    :param config_path: Path to load JSON config
    """

    try:
        config_dict = load_config_file(config_path)
        # no logging for config because apps might have custom secrets
        workflow = ApplicationWorkflow.create(config_dict)
    except Exception as exc:
        logger.error(f"Error running the application {exc}")
        logger.debug(traceback.format_exc())
        sys.exit(1)

    workflow.execute()
    workflow.stop()
    workflow.print_status()
    workflow.raise_from_status()
