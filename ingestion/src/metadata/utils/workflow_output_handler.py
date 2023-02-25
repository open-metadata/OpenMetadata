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
Module handles the output messages from different workflows
"""

import time
from enum import Enum
from pathlib import Path
from typing import Type, Union

from metadata.config.common import ConfigurationError
from metadata.ingestion.api.parser import (
    InvalidWorkflowException,
    ParsingConfigurationError,
)
from metadata.utils.constants import UTF_8
from metadata.utils.helpers import pretty_print_time_duration
from metadata.utils.logger import ANSI, log_ansi_encoded_string

WORKFLOW_FAILURE_MESSAGE = "Workflow finished with failures"
WORKFLOW_WARNING_MESSAGE = "Workflow finished with warnings"
WORKFLOW_SUCCESS_MESSAGE = "Workflow finished successfully"


class WorkflowType(Enum):
    """
    Workflow type enums
    """

    INGEST = "ingest"
    PROFILE = "profile"
    TEST = "test"
    LINEAGE = "lineage"
    USAGE = "usage"


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


def print_more_info(workflow_type: WorkflowType) -> None:
    """
    Print more information message
    """
    log_ansi_encoded_string(
        message=f"\nFor more information, please visit: {URLS[workflow_type]}"
        "\nOr join us in Slack: https://slack.open-metadata.org/"
    )


def print_error_msg(msg: str) -> None:
    """
    Print message with error style
    """
    log_ansi_encoded_string(color=ANSI.BRIGHT_RED, bold=False, message=f"{msg}")


def print_sink_status(workflow) -> None:
    """
    Common prints for Sink status
    """

    log_ansi_encoded_string(bold=True, message="Processor Status:")
    log_ansi_encoded_string(message=workflow.status.as_string())
    if hasattr(workflow, "sink"):
        log_ansi_encoded_string(bold=True, message="Sink Status:")
        log_ansi_encoded_string(message=workflow.sink.get_status().as_string())


def calculate_ingestion_type(source_type_name: str) -> WorkflowType:
    """
    Calculates the ingestion type depending on the source type name
    """
    if source_type_name.endswith("lineage"):
        return WorkflowType.LINEAGE
    if source_type_name.endswith("usage"):
        return WorkflowType.USAGE
    return WorkflowType.INGEST


def calculate_example_file(source_type_name: str, workflow_type: WorkflowType) -> str:
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


def print_file_example(source_type_name: str, workflow_type: WorkflowType):
    """
    Print an example file for a given configuration
    """
    if source_type_name is not None:
        example_file = calculate_example_file(source_type_name, workflow_type)
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


def print_init_error(
    exc: Union[Exception, Type[Exception]],
    config: dict,
    workflow_type: WorkflowType = WorkflowType.INGEST,
) -> None:
    """
    Print a workflow initialization error
    """
    source_type_name = None
    if (
        config
        and config.get("source", None) is not None
        and config["source"].get("type", None) is not None
    ):
        source_type_name = config["source"].get("type")
        source_type_name = source_type_name.replace("-", "-")
        workflow_type = (
            calculate_ingestion_type(source_type_name)
            if workflow_type == WorkflowType.INGEST
            else workflow_type
        )

    if isinstance(
        exc, (ParsingConfigurationError, ConfigurationError, InvalidWorkflowException)
    ):
        print_error_msg(f"Error loading {workflow_type.name} configuration: {exc}")
        print_file_example(source_type_name, workflow_type)
        print_more_info(workflow_type)
    else:
        print_error_msg(f"\nError initializing {workflow_type.name}: {exc}")
        print_more_info(workflow_type)


def print_status(workflow) -> None:
    """
    Print the workflow results
    """
    log_ansi_encoded_string(bold=True, message="Source Status:")
    log_ansi_encoded_string(message=workflow.source.get_status().as_string())
    if hasattr(workflow, "stage"):
        log_ansi_encoded_string(bold=True, message="Stage Status:")
        log_ansi_encoded_string(message=workflow.stage.get_status().as_string())
    if hasattr(workflow, "sink"):
        log_ansi_encoded_string(bold=True, message="Sink Status:")
        log_ansi_encoded_string(message=workflow.sink.get_status().as_string())
    if hasattr(workflow, "bulk_sink"):
        log_ansi_encoded_string(bold=True, message="Bulk Sink Status:")
        log_ansi_encoded_string(message=workflow.bulk_sink.get_status().as_string())

    if workflow.source.get_status().source_start_time:
        log_ansi_encoded_string(
            color=ANSI.BRIGHT_CYAN,
            bold=True,
            message="Workflow finished in time: "
            f"{pretty_print_time_duration(time.time()-workflow.source.get_status().source_start_time)}",
        )

        log_ansi_encoded_string(
            color=ANSI.BRIGHT_CYAN,
            bold=True,
            message=f"Success %: "
            f"{workflow.source.get_status().calculate_success()}",
        )

    if workflow.result_status() == 1:
        log_ansi_encoded_string(
            color=ANSI.BRIGHT_RED,
            bold=True,
            message=WORKFLOW_FAILURE_MESSAGE,
        )
    elif workflow.source.get_status().warnings or (
        hasattr(workflow, "sink") and workflow.sink.get_status().warnings
    ):
        log_ansi_encoded_string(
            color=ANSI.YELLOW, bold=True, message=WORKFLOW_WARNING_MESSAGE
        )
    else:
        log_ansi_encoded_string(
            color=ANSI.GREEN, bold=True, message=WORKFLOW_SUCCESS_MESSAGE
        )


def print_profiler_status(workflow) -> None:
    """
    Print the profiler workflow results
    """
    log_ansi_encoded_string(bold=True, message="Source Status:")
    log_ansi_encoded_string(message=workflow.source_status.as_string())
    print_sink_status(workflow)

    if workflow.result_status() == 1:
        log_ansi_encoded_string(
            color=ANSI.BRIGHT_RED, bold=True, message=WORKFLOW_FAILURE_MESSAGE
        )
    elif (
        workflow.source_status.warnings
        or workflow.status.failures
        or (hasattr(workflow, "sink") and workflow.sink.get_status().warnings)
    ):
        log_ansi_encoded_string(
            color=ANSI.YELLOW, bold=True, message=WORKFLOW_WARNING_MESSAGE
        )
    else:
        log_ansi_encoded_string(
            color=ANSI.GREEN, bold=True, message=WORKFLOW_SUCCESS_MESSAGE
        )


def print_test_suite_status(workflow) -> None:
    """
    Print the test suite workflow results
    """
    print_sink_status(workflow)

    if workflow.result_status() == 1:
        log_ansi_encoded_string(
            color=ANSI.BRIGHT_RED, bold=True, message=WORKFLOW_FAILURE_MESSAGE
        )
    else:
        log_ansi_encoded_string(
            color=ANSI.GREEN, bold=True, message=WORKFLOW_SUCCESS_MESSAGE
        )


def print_data_insight_status(workflow) -> None:
    """
    Print the test suite workflow results
    Args:
        workflow (DataInsightWorkflow): workflow object
    """
    log_ansi_encoded_string(message="Processor Status:")
    log_ansi_encoded_string(message=workflow.data_processor.get_status().as_string())
    print_sink_status(workflow)

    if workflow.data_processor.get_status().source_start_time:
        log_ansi_encoded_string(
            message=f"Workflow finished in time {pretty_print_time_duration(time.time()-workflow.data_processor.get_status().source_start_time)} ",  # pylint: disable=line-too-long
        )

    if workflow.result_status() == 1:
        log_ansi_encoded_string(message=WORKFLOW_FAILURE_MESSAGE)
    elif (
        workflow.data_processor.get_status().warnings
        or workflow.status.warnings
        or (hasattr(workflow, "sink") and workflow.sink.get_status().warnings)
    ):
        log_ansi_encoded_string(message=WORKFLOW_WARNING_MESSAGE)
    else:
        log_ansi_encoded_string(message=WORKFLOW_SUCCESS_MESSAGE)
        log_ansi_encoded_string(
            color=ANSI.GREEN, bold=True, message=WORKFLOW_SUCCESS_MESSAGE
        )
