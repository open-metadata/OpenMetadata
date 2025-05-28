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
Data quality utility for the metadata CLI
"""
import sys
import traceback
from pathlib import Path

from metadata.cli.common import execute_workflow
from metadata.config.common import load_config_file
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineType,
)
from metadata.utils.logger import cli_logger, redacted_config
from metadata.workflow.workflow_init_error_handler import WorkflowInitErrorHandler

logger = cli_logger()


def run_test(config_path: Path) -> None:
    """
    Run the Data Quality Test Suites workflow from a config path
    to a JSON or YAML file
    :param config_path: Path to load JSON config
    """

    workflow_config_dict = None
    try:
        # pylint: disable=import-outside-toplevel
        from metadata.workflow.data_quality import TestSuiteWorkflow

        workflow_config_dict = load_config_file(config_path)
        logger.debug(
            "Using workflow config:\n%s", redacted_config(workflow_config_dict)
        )
        workflow = TestSuiteWorkflow.create(workflow_config_dict)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        WorkflowInitErrorHandler.print_init_error(
            exc, workflow_config_dict, PipelineType.TestSuite
        )
        sys.exit(1)

    execute_workflow(workflow=workflow, config_dict=workflow_config_dict)
