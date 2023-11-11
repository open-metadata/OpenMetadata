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
import traceback
from enum import Enum
from logging import Logger
from pathlib import Path
from typing import Dict, List, Type, Union

from pydantic import BaseModel
from tabulate import tabulate

from metadata.config.common import ConfigurationError
from metadata.generated.schema.metadataIngestion.workflow import LogLevels
from metadata.ingestion.api.models import StackTraceError
from metadata.ingestion.api.parser import (
    InvalidWorkflowException,
    ParsingConfigurationError,
)
from metadata.ingestion.api.status import Status
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import BulkSink, Processor, Sink, Source, Stage
from metadata.timer.repeated_timer import RepeatedTimer
from metadata.utils.constants import UTF_8
from metadata.utils.helpers import pretty_print_time_duration
from metadata.utils.logger import ANSI, log_ansi_encoded_string

WORKFLOW_FAILURE_MESSAGE = "Workflow finished with failures"
WORKFLOW_WARNING_MESSAGE = "Workflow finished with warnings"
WORKFLOW_SUCCESS_MESSAGE = "Workflow finished successfully"


class Failure(BaseModel):
    """
    Auxiliary class to print the error per status
    """

    name: str
    failures: List[StackTraceError]


class Summary(BaseModel):
    """
    Auxiliary class to calculate the summary of all statuses
    """

    records = 0
    warnings = 0
    errors = 0
    filtered = 0

    def __add__(self, other):
        self.records += other.records
        self.warnings += other.warnings
        self.errors += other.errors
        self.filtered += other.filtered
        return self


class WorkflowType(Enum):
    """
    Workflow type enums
    """

    INGEST = "ingest"
    PROFILE = "profile"
    TEST = "test"
    LINEAGE = "lineage"
    USAGE = "usage"
    INSIGHT = "insight"


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


def print_status(workflow: "BaseWorkflow") -> None:
    """
    Print the workflow results
    """

    print_workflow_summary(workflow)

    if workflow.source.get_status().source_start_time:
        log_ansi_encoded_string(
            color=ANSI.BRIGHT_CYAN,
            bold=True,
            message="Workflow finished in time: "
            f"{pretty_print_time_duration(time.time()-workflow.source.get_status().source_start_time)}",
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


def is_debug_enabled(workflow) -> bool:
    return (
        hasattr(workflow, "config")
        and hasattr(workflow.config, "workflowConfig")
        and hasattr(workflow.config.workflowConfig, "loggerLevel")
        and workflow.config.workflowConfig.loggerLevel is LogLevels.DEBUG
    )


def get_generic_step_name(step: Step) -> str:
    """
    Since we cannot directly log the step name
    as step.__class__.__name__ since it brings too
    much internal info (e.g., MetadataRestSink), we'll
    just check here for the simplification.
    """
    for step_type in (Source, Processor, Stage, Sink, BulkSink):
        if isinstance(step, step_type):
            return step_type.__name__

    return type(step).__name__


def print_workflow_summary(workflow: "BaseWorkflow") -> None:
    """
    Args:
        workflow: the workflow status to be printed

    Returns:
        Print Workflow status when the workflow logger level is DEBUG
    """

    if is_debug_enabled(workflow):
        print_workflow_status_debug(workflow)

    failures = []
    total_records = 0
    total_errors = 0
    for step in [workflow.source] + list(workflow.steps):
        step_summary = get_summary(step.get_status())
        total_records += step_summary.records
        total_errors += step_summary.errors
        failures.append(
            Failure(
                name=get_generic_step_name(step), failures=step.get_status().failures
            )
        )

        log_ansi_encoded_string(
            bold=True, message=f"Workflow {get_generic_step_name(step)} Summary:"
        )
        log_ansi_encoded_string(message=f"Processed records: {step_summary.records}")
        log_ansi_encoded_string(message=f"Warnings: {step_summary.warnings}")
        if isinstance(step, Source):
            log_ansi_encoded_string(message=f"Filtered: {step_summary.filtered}")
        log_ansi_encoded_string(message=f"Errors: {step_summary.errors}")

    print_failures_if_apply(failures)

    total_success = max(total_records, 1)
    log_ansi_encoded_string(
        color=ANSI.BRIGHT_CYAN,
        bold=True,
        message=f"Success %: "
        f"{round(total_success * 100 / (total_success + total_errors), 2)}",
    )


def print_workflow_status_debug(workflow: "BaseWorkflow") -> None:
    """Print the statuses from each workflow step"""
    log_ansi_encoded_string(bold=True, message="Statuses detailed info:")
    for step in [workflow.source] + list(workflow.steps):
        log_ansi_encoded_string(
            bold=True, message=f"{get_generic_step_name(step)} Status:"
        )
        log_ansi_encoded_string(message=step.get_status().as_string())


def get_summary(status: Status) -> Summary:
    records = len(status.records)
    warnings = len(status.warnings)
    errors = len(status.failures)
    filtered = len(status.filtered)
    return Summary(records=records, warnings=warnings, errors=errors, filtered=filtered)


def get_failures(failure: Failure) -> List[Dict[str, str]]:
    return [
        {
            "From": failure.name,
            "Entity Name": f.name,
            "Message": f.error,
            "Stack Trace": f.stack_trace,
        }
        for f in failure.failures
    ]


def print_failures_if_apply(failures: List[Failure]) -> None:
    # take only the ones that contain failures
    failures = [f for f in failures if f.failures]
    if failures:
        # create a list of dictionaries' list
        all_data = [get_failures(failure) for failure in failures]
        # create a single of dictionaries
        data = [f for fs in all_data for f in fs]
        # create a dictionary with a key and a list of values from the list
        error_table = {k: [dic[k] for dic in data] for k in data[0]}
        if len(list(error_table.items())[0][1]) > 100:
            log_ansi_encoded_string(
                bold=True, message="Showing only the first 100 failures:"
            )
            # truncate list if number of values are over 100
            error_table = {k: v[:100] for k, v in error_table.items()}
        else:
            log_ansi_encoded_string(bold=True, message="List of failures:")

        log_ansi_encoded_string(
            message=f"\n{tabulate(error_table, headers='keys', tablefmt='grid')}"
        )


def report_ingestion_status(logger: Logger, workflow: "BaseWorkflow") -> None:
    """
    Given a logger, use it to INFO the workflow status
    """
    try:
        for step in [workflow.source] + list(workflow.steps):
            logger.info(
                f"{get_generic_step_name(step)}: Processed {len(step.status.records)} records,"
                f" filtered {len(step.status.filtered)} records,"
                f" found {len(step.status.failures)} errors"
            )

    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Wild exception reporting status - {exc}")


def get_ingestion_status_timer(
    interval: int, logger: Logger, workflow: "BaseWorkflow"
) -> RepeatedTimer:
    """
    Prepare the threading Timer to execute the report_ingestion_status
    """
    return RepeatedTimer(interval, report_ingestion_status, logger, workflow)
