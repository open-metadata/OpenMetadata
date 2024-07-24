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
from pathlib import Path
from typing import Any, Dict, List, Optional, Type, Union

from pydantic import BaseModel
from tabulate import tabulate

from metadata.config.common import ConfigurationError
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.ingestion.api.parser import (
    InvalidWorkflowException,
    ParsingConfigurationError,
)
from metadata.ingestion.api.step import Step, Summary
from metadata.ingestion.lineage.models import QueryParsingFailures
from metadata.utils.constants import UTF_8
from metadata.utils.deprecation import deprecated
from metadata.utils.execution_time_tracker import ExecutionTimeTracker
from metadata.utils.helpers import pretty_print_time_duration
from metadata.utils.logger import ANSI, log_ansi_encoded_string
from metadata.workflow.workflow_status_mixin import WorkflowResultStatus

WORKFLOW_FAILURE_MESSAGE = "Workflow finished with failures"
WORKFLOW_WARNING_MESSAGE = "Workflow finished with warnings"
WORKFLOW_SUCCESS_MESSAGE = "Workflow finished successfully"


class Failure(BaseModel):
    """
    Auxiliary class to print the error per status
    """

    name: str
    failures: List[StackTraceError]


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


@deprecated(message="Use 'workflow.print_status()' instead.", release="1.8")
def print_status(workflow: "BaseWorkflow"):  # pyright: ignore[ReportUndefinedVariable]
    workflow.print_status()


class WorkflowOutputHandler:
    """Responsible for dealing with the Workflow Outputs"""

    def print_status(
        self,
        result_status: WorkflowResultStatus,
        steps: List[Step],
        start_time: Optional[Any] = None,
        debug: bool = False,
    ):
        """
        Print the workflow results
        """
        self.print_summary(steps, debug)

        if start_time:
            log_ansi_encoded_string(
                color=ANSI.BRIGHT_CYAN,
                bold=True,
                message="Workflow finished in time: "
                f"{pretty_print_time_duration(time.time() - start_time)}",
            )

        if result_status == WorkflowResultStatus.FAILURE:
            log_ansi_encoded_string(
                color=ANSI.BRIGHT_RED,
                bold=True,
                message=WORKFLOW_FAILURE_MESSAGE,
            )

    def print_summary(self, steps: List[Step], debug: bool = False):
        if debug:
            self._print_debug_summary(steps)
            self._print_execution_time_summary()
            self._print_query_parsing_issues()

        self._print_summary(steps)

    def _print_summary(self, steps: List[Step]):
        failures = []
        total_records: int = 0
        total_errors: int = 0

        for step in steps:
            step_summary = Summary.from_step(step)

            total_records += step_summary.records or 0
            total_errors += step_summary.errors or 0
            failures.append(
                Failure(name=step.name, failures=step.get_status().failures)
            )

            log_ansi_encoded_string(bold=True, message=f"Workflow {step.name} Summary:")
            log_ansi_encoded_string(
                message=f"Processed records: {step_summary.records}"
            )
            log_ansi_encoded_string(
                message=f"Updated records: {step_summary.updated_records}"
            )
            log_ansi_encoded_string(message=f"Warnings: {step_summary.warnings}")

            if step_summary.filtered:
                log_ansi_encoded_string(message=f"Filtered: {step_summary.filtered}")

            log_ansi_encoded_string(message=f"Errors: {step_summary.errors}")

        self._print_failures_if_apply(failures)

        total_success = max(total_records, 1)
        log_ansi_encoded_string(
            color=ANSI.BRIGHT_CYAN,
            bold=True,
            message=f"Success %: "
            f"{round(total_success * 100 / (total_success + total_errors), 2)}",
        )

    def _print_debug_summary(self, steps: List[Step]):
        log_ansi_encoded_string(bold=True, message="Statuses detailed info:")

        for step in steps:
            log_ansi_encoded_string(bold=True, message=f"{step.name} Status:")
            log_ansi_encoded_string(message=step.get_status().as_string())

    def _print_execution_time_summary(self):
        """Log the ExecutionTimeTracker Summary."""
        tracker = ExecutionTimeTracker()

        summary_table = {
            "Context": [],
            "Execution Time Aggregate": [],
        }

        for key in sorted(tracker.state.state.keys()):
            summary_table["Context"].append(key)
            summary_table["Execution Time Aggregate"].append(
                pretty_print_time_duration(tracker.state.state[key])
            )

        log_ansi_encoded_string(bold=True, message="Execution Time Summary")
        log_ansi_encoded_string(message=f"\n{tabulate(summary_table, tablefmt='grid')}")

    def _print_query_parsing_issues(self):
        """Log the QueryParsingFailures Summary."""
        query_failures = QueryParsingFailures()

        summary_table = {
            "Query": [],
            "Error": [],
        }

        for failure in query_failures:
            summary_table["Query"].append(failure.query)
            summary_table["Error"].append(failure.error)

        if summary_table["Query"]:
            log_ansi_encoded_string(bold=True, message="Query Parsing Error Summary")
            log_ansi_encoded_string(
                message=f"\n{tabulate(summary_table, tablefmt='grid', headers=summary_table.keys())}"
            )

    def _get_failures(self, failure: Failure) -> List[Dict[str, str]]:
        return [
            {
                "From": failure.name,
                "Entity Name": f.name,
                "Message": f.error,
                "Stack Trace": f.stackTrace,
            }
            for f in failure.failures
        ]

    def _print_failures_if_apply(self, failures: List[Failure]) -> None:
        # take only the ones that contain failures
        failures = [f for f in failures if f.failures]
        if failures:
            # create a list of dictionaries' list
            all_data = [self._get_failures(failure) for failure in failures]
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
        print_error_msg(traceback.format_exc())
        print_more_info(workflow_type)
