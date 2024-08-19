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
Ingest utility for the metadata CLI
"""
import sys
import traceback
from pathlib import Path

from metadata.config.common import load_config_file
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineType,
)
from metadata.utils.logger import cli_logger
from metadata.workflow.profiler import ProfilerWorkflow
from metadata.workflow.workflow_init_error_handler import WorkflowInitErrorHandler

logger = cli_logger()


def run_profiler(config_path: Path) -> None:
    """
    Run the Profiler workflow from a config path
    to a JSON or YAML file
    :param config_path: Path to load JSON config
    """

    workflow_config_dict = None
    try:
        workflow_config_dict = load_config_file(config_path)
        workflow = ProfilerWorkflow.create(workflow_config_dict)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        WorkflowInitErrorHandler.print_init_error(
            exc, workflow_config_dict, PipelineType.profiler
        )
        sys.exit(1)

    workflow.execute()
    workflow.stop()
    workflow.print_status()
    workflow.raise_from_status()
