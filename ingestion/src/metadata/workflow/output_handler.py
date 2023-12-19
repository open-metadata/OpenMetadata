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
Common Output Handling methods
"""
import traceback
from enum import Enum
from logging import Logger
from pathlib import Path
from typing import Dict, List

from metadata.generated.schema.entity.services.ingestionPipelines.status import StepSummary, Failure
from pydantic import BaseModel
from tabulate import tabulate

from metadata.generated.schema.metadataIngestion.workflow import LogLevels
from metadata.generated.schema.entity.services.ingestionPipelines.status import StackTraceError
from metadata.ingestion.api.status import Status
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import BulkSink, Processor, Sink, Source, Stage
from metadata.utils.logger import ANSI, log_ansi_encoded_string

WORKFLOW_FAILURE_MESSAGE = "Workflow finished with failures"
WORKFLOW_WARNING_MESSAGE = "Workflow finished with warnings"
WORKFLOW_SUCCESS_MESSAGE = "Workflow finished successfully"


class Summary(StepSummary):
    """
    Auxiliary class to calculate the summary of all statuses
    """

    def __add__(self, other):
        self.records += other.records
        self.warnings += other.warnings
        self.errors += other.errors
        self.filtered += other.filtered
        return self


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
            "Stack Trace": f.stackTrace,
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


def is_debug_enabled(workflow) -> bool:
    return (
        hasattr(workflow, "config")
        and hasattr(workflow.config, "workflowConfig")
        and hasattr(workflow.config.workflowConfig, "loggerLevel")
        and workflow.config.workflowConfig.loggerLevel is LogLevels.DEBUG
    )


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
    for step in workflow.workflow_steps():
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
        if step_summary.filtered:
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
    for step in workflow.workflow_steps():
        log_ansi_encoded_string(
            bold=True, message=f"{get_generic_step_name(step)} Status:"
        )
        log_ansi_encoded_string(message=step.get_status().as_string())


def report_ingestion_status(logger: Logger, workflow: "BaseWorkflow") -> None:
    """
    Given a logger, use it to INFO the workflow status
    """
    try:
        for step in workflow.workflow_steps():
            logger.info(
                f"{get_generic_step_name(step)}: Processed {len(step.status.records)} records,"
                f" filtered {len(step.status.filtered)} records,"
                f" found {len(step.status.failures)} errors"
            )

    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Wild exception reporting status - {exc}")
