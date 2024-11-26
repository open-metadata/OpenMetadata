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
Module handles the init error messages from different workflows
"""
import logging
import traceback
from pathlib import Path
from typing import Any, Dict, Optional, Type, Union

from metadata.config.common import ConfigurationError
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineType,
)
from metadata.ingestion.api.parser import (
    InvalidWorkflowException,
    ParsingConfigurationError,
)
from metadata.utils.constants import UTF_8
from metadata.utils.logger import ANSI, log_ansi_encoded_string, utils_logger

EXAMPLES_WORKFLOW_PATH: Path = Path(__file__).parent / "../examples" / "workflows"


URLS: Dict[PipelineType, str] = {
    PipelineType.metadata: "https://docs.open-metadata.org/connectors/ingestion/workflows/metadata",
    PipelineType.profiler: "https://docs.open-metadata.org/connectors/ingestion/workflows/profiler",
    PipelineType.TestSuite: "https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality",
    PipelineType.lineage: "https://docs.open-metadata.org/connectors/ingestion/workflows/lineage",
    PipelineType.usage: "https://docs.open-metadata.org/connectors/ingestion/workflows/usage",
    PipelineType.dbt: "https://docs.open-metadata.org/connectors/ingestion/workflows/dbt",
}


DEFAULT_EXAMPLE_FILE: Dict[PipelineType, str] = {
    PipelineType.metadata: "bigquery",
    PipelineType.profiler: "bigquery_profiler",
    PipelineType.TestSuite: "test_suite",
    PipelineType.lineage: "bigquery_lineage",
    PipelineType.usage: "bigquery_usage",
}


class WorkflowInitErrorHandler:
    """Resonsible for handling the InitError flow, when a Workflow errors before even initializing."""

    @staticmethod
    def print_init_error(
        exc: Union[Exception, Type[Exception]],
        config: Dict[str, Any],
        pipeline_type: PipelineType = PipelineType.metadata,
    ):
        """
        Print a workflow initialization error
        """
        source_type_name = WorkflowInitErrorHandler._get_source_type_name(config)

        if isinstance(
            exc,
            (ParsingConfigurationError, ConfigurationError, InvalidWorkflowException),
        ):
            WorkflowInitErrorHandler._print_error_msg(
                f"Error loading {pipeline_type.name} configuration: {exc}"
            )
            WorkflowInitErrorHandler._print_file_example(
                source_type_name, pipeline_type
            )
        else:
            utils_logger().debug(traceback.format_exc())
            WorkflowInitErrorHandler._print_error_msg(
                f"\nError initializing {pipeline_type.name}: {exc}"
            )

        WorkflowInitErrorHandler._print_more_info(pipeline_type)

    @staticmethod
    def _get_source_type_name(config: Dict[str, Any]) -> Optional[str]:
        """Returns the Source Type Name based on the Configuration passed."""
        source_type_name = None

        if (
            config
            and config.get("source", None) is not None
            and config["source"].get("type", None) is not None
        ):
            source_type_name = config["source"].get("type")
            source_type_name = source_type_name.replace("-", "-")

        return source_type_name

    @staticmethod
    def _print_file_example(
        source_type_name: Optional[str], pipeline_type: PipelineType
    ):
        """
        Print an example file for a given configuration
        """
        if source_type_name is not None:
            example_file = WorkflowInitErrorHandler._calculate_example_file(
                source_type_name, pipeline_type
            )
            example_path = EXAMPLES_WORKFLOW_PATH / f"{example_file}.yaml"
            if not example_path.exists():
                example_file = DEFAULT_EXAMPLE_FILE[pipeline_type]
                example_path = EXAMPLES_WORKFLOW_PATH / f"{example_file}.yaml"
            log_ansi_encoded_string(
                message=f"\nMake sure you are following the following format e.g. '{example_file}':"
            )
            log_ansi_encoded_string(message="------------")
            with open(example_path, encoding=UTF_8) as file:
                log_ansi_encoded_string(message=file.read())
            log_ansi_encoded_string(message="------------")

    @staticmethod
    def _calculate_example_file(
        source_type_name: str, pipeline_type: PipelineType
    ) -> str:
        """
        Calculates the ingestion type depending on the source type name and workflow_type
        """
        if pipeline_type == PipelineType.usage:
            return f"{source_type_name}_usage"
        if pipeline_type == PipelineType.lineage:
            return f"{source_type_name}_lineage"
        if pipeline_type == PipelineType.profiler:
            return f"{source_type_name}_profiler"
        if pipeline_type == PipelineType.TestSuite:
            return DEFAULT_EXAMPLE_FILE[pipeline_type]
        return source_type_name

    @staticmethod
    def _print_more_info(pipeline_type: PipelineType) -> None:
        """
        Print more information message
        """
        log_ansi_encoded_string(
            message=f"\nFor more information, please visit: {URLS[pipeline_type]}"
            + "\nOr join us in Slack: https://slack.open-metadata.org/"
        )

    @staticmethod
    def _print_error_msg(msg: str) -> None:
        """
        Print message with error style
        """
        log_ansi_encoded_string(
            color=ANSI.BRIGHT_RED, bold=False, message=f"{msg}", level=logging.ERROR
        )

    @staticmethod
    def _print_debug_msg(msg: str) -> None:
        """
        Print message with error style
        """
        log_ansi_encoded_string(
            color=ANSI.YELLOW, bold=False, message=f"{msg}", level=logging.DEBUG
        )
