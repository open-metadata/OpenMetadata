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
import traceback
from enum import Enum
from pathlib import Path
from typing import Any, Dict, Optional, Type, Union

from metadata.config.common import ConfigurationError
from metadata.ingestion.api.parser import (
    InvalidWorkflowException,
    ParsingConfigurationError,
)
from metadata.utils.constants import UTF_8
from metadata.utils.logger import ANSI, log_ansi_encoded_string


class WorkflowType(Enum):
    """
    Workflow type enums based on the `metadata` CLI commands
    """

    INGEST = "ingest"
    PROFILE = "profile"
    TEST = "test"
    LINEAGE = "lineage"
    USAGE = "usage"
    INSIGHT = "insight"
    APP = "application"


EXAMPLES_WORKFLOW_PATH: Path = Path(__file__).parent / "../examples" / "workflows"


URLS = {
    WorkflowType.INGEST: "https://docs.open-metadata.org/connectors/ingestion/workflows/metadata",
    WorkflowType.PROFILE: "https://docs.open-metadata.org/connectors/ingestion/workflows/profiler",
    WorkflowType.TEST: "https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality",
    WorkflowType.LINEAGE: "https://docs.open-metadata.org/connectors/ingestion/workflows/lineage",
    WorkflowType.USAGE: "https://docs.open-metadata.org/connectors/ingestion/workflows/usage",
}


DEFAULT_EXAMPLE_FILE = {
    WorkflowType.INGEST: "bigquery",
    WorkflowType.PROFILE: "bigquery_profiler",
    WorkflowType.TEST: "test_suite",
    WorkflowType.LINEAGE: "bigquery_lineage",
    WorkflowType.USAGE: "bigquery_usage",
}


class WorkflowInitErrorHandler:
    """Resonsible for handling the InitError flow, when a Workflow errors before even initializing."""

    @staticmethod
    def print_init_error(
        exc: Union[Exception, Type[Exception]],
        config: Dict[str, Any],
        workflow_type: WorkflowType = WorkflowType.INGEST,
    ) -> None:
        """
        Print a workflow initialization error
        """
        source_type_name = WorkflowInitErrorHandler._get_source_type_name(config)
        workflow_type = WorkflowInitErrorHandler._update_workflow_type(
            source_type_name, workflow_type
        )

        if isinstance(
            exc,
            (ParsingConfigurationError, ConfigurationError, InvalidWorkflowException),
        ):
            WorkflowInitErrorHandler._print_error_msg(
                f"Error loading {workflow_type.name} configuration: {exc}"
            )
            WorkflowInitErrorHandler._print_file_example(
                source_type_name, workflow_type
            )
        else:
            WorkflowInitErrorHandler._print_error_msg(
                f"\nError initializing {workflow_type.name}: {exc}"
            )
            WorkflowInitErrorHandler._print_error_msg(traceback.format_exc())

        WorkflowInitErrorHandler._print_more_info(workflow_type)

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
    def _update_workflow_type(
        source_type_name: Optional[str], workflow_type: WorkflowType
    ) -> WorkflowType:
        """Updates the WorkflowType if needed.
        When WorkflowType.INGEST is received, it can be algo LINEAGE or USAGE, depending on the Source Type Name.
        """
        if source_type_name and workflow_type == WorkflowType.INGEST:
            if source_type_name.endswith("lineage"):
                return WorkflowType.LINEAGE
            elif source_type_name.endswith("usage"):
                return WorkflowType.USAGE
        return workflow_type

    @staticmethod
    def _print_file_example(
        source_type_name: Optional[str], workflow_type: WorkflowType
    ):
        """
        Print an example file for a given configuration
        """
        if source_type_name is not None:
            example_file = WorkflowInitErrorHandler._calculate_example_file(
                source_type_name, workflow_type
            )
            example_path = EXAMPLES_WORKFLOW_PATH / f"{example_file}.yaml"
            if not example_path.exists():
                example_file = DEFAULT_EXAMPLE_FILE[workflow_type]
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
        source_type_name: str, workflow_type: WorkflowType
    ) -> str:
        """
        Calculates the ingestion type depending on the source type name and workflow_type
        """
        if workflow_type == WorkflowType.USAGE:
            return f"{source_type_name}_usage"
        if workflow_type == WorkflowType.LINEAGE:
            return f"{source_type_name}_lineage"
        if workflow_type == WorkflowType.PROFILE:
            return f"{source_type_name}_profiler"
        if workflow_type == WorkflowType.TEST:
            return DEFAULT_EXAMPLE_FILE[workflow_type]
        return source_type_name

    @staticmethod
    def _print_more_info(workflow_type: WorkflowType) -> None:
        """
        Print more information message
        """
        log_ansi_encoded_string(
            message=f"\nFor more information, please visit: {URLS[workflow_type]}"
            + "\nOr join us in Slack: https://slack.open-metadata.org/"
        )

    @staticmethod
    def _print_error_msg(msg: str) -> None:
        """
        Print message with error style
        """
        log_ansi_encoded_string(color=ANSI.BRIGHT_RED, bold=False, message=f"{msg}")
