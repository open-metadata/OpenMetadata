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

import click

from metadata.config.common import ConfigurationError
from metadata.ingestion.api.parser import (
    InvalidWorkflowException,
    ParsingConfigurationError,
)
from metadata.utils.constants import UTF_8
from metadata.utils.helpers import pretty_print_time_duration


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
    WorkflowType.INGEST: "https://docs.open-metadata.org/openmetadata/ingestion",
    WorkflowType.PROFILE: "https://docs.open-metadata.org/openmetadata/ingestion/workflows/profiler",
    WorkflowType.TEST: "https://docs.open-metadata.org/openmetadata/ingestion/workflows/data-quality",
    WorkflowType.LINEAGE: "https://docs.open-metadata.org/openmetadata/ingestion/workflows/lineage",
    WorkflowType.USAGE: "https://docs.open-metadata.org/openmetadata/ingestion/workflows/usage",
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
    Click echo print more information message
    """
    click.echo(
        f"\nFor more information, please visit: {URLS[workflow_type]}\nOr join us in Slack: https://slack.open-metadata.org/"  # pylint: disable=line-too-long
    )


def print_error_msg(msg: str) -> None:
    """
    Click echo print message with error style
    """
    click.secho(msg, fg="red")


def print_sink_status(workflow) -> None:
    """
    Common click echo prints for Sink status
    """
    click.echo()
    click.secho("Processor Status:", bold=True)
    click.echo(workflow.status.as_string())
    if hasattr(workflow, "sink"):
        click.secho("Sink Status:", bold=True)
        click.echo(workflow.sink.get_status().as_string())
        click.echo()


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
    if workflow_type == WorkflowType.PROFILE:
        return f"{source_type_name}_profiler"
    if workflow_type == WorkflowType.TEST:
        return DEFAULT_EXAMPLE_FILE[workflow_type]
    return source_type_name


def print_file_example(source_type_name: str, workflow_type: WorkflowType):
    """
    Click echo print an example file for a given configuration
    """
    if source_type_name is not None:
        example_file = calculate_example_file(source_type_name, workflow_type)
        example_path = EXAMPLES_WORKFLOW_PATH / example_file
        if not example_path.exists():
            example_file = DEFAULT_EXAMPLE_FILE[workflow_type]
            example_path = EXAMPLES_WORKFLOW_PATH / f"{example_file}.yaml"
        click.echo(
            f"\nMake sure you are following the following format e.g. '{example_file}':"
        )
        click.echo("------------")
        with open(example_path, encoding=UTF_8) as file:
            click.echo(file.read())
        click.echo("------------")


def print_init_error(
    exc: Union[Exception, Type[Exception]],
    config: dict,
    workflow_type: WorkflowType = WorkflowType.INGEST,
) -> None:
    """
    Click echo print a workflow initialization error
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

    if isinstance(exc, ParsingConfigurationError):
        print_error_msg(f"Error loading {workflow_type.name} configuration: {exc}")
        print_file_example(source_type_name, workflow_type)
        print_more_info(workflow_type)
    elif isinstance(exc, (ConfigurationError, InvalidWorkflowException)):
        print_error_msg(f"Error loading {workflow_type.name} configuration: {exc}")
        if workflow_type == WorkflowType.USAGE:
            print_file_example(source_type_name, workflow_type)
        print_more_info(workflow_type)
    else:
        print_error_msg(f"\nError initializing {workflow_type.name}: {exc}")
        print_more_info(workflow_type)


def print_status(workflow) -> None:
    """
    Runs click echo to print the workflow results
    """
    click.echo()
    click.secho("Source Status:", bold=True)
    click.echo(workflow.source.get_status().as_string())
    if hasattr(workflow, "stage"):
        click.secho("Stage Status:", bold=True)
        click.echo(workflow.stage.get_status().as_string())
        click.echo()
    if hasattr(workflow, "sink"):
        click.secho("Sink Status:", bold=True)
        click.echo(workflow.sink.get_status().as_string())
        click.echo()
    if hasattr(workflow, "bulk_sink"):
        click.secho("Bulk Sink Status:", bold=True)
        click.echo(workflow.bulk_sink.get_status().as_string())
        click.echo()

    if workflow.source.get_status().source_start_time:
        click.secho(
            f"Workflow finished in time {pretty_print_time_duration(time.time()-workflow.source.get_status().source_start_time)} ",  # pylint: disable=line-too-long
            fg="bright_cyan",
            bold=True,
        )

        click.secho(
            f"Success % : {workflow.source.get_status().calculate_success()}",
            fg="bright_cyan",
            bold=True,
        )

    if workflow.result_status() == 1:
        click.secho("Workflow finished with failures", fg="bright_red", bold=True)
    elif workflow.source.get_status().warnings or (
        hasattr(workflow, "sink") and workflow.sink.get_status().warnings
    ):
        click.secho("Workflow finished with warnings", fg="yellow", bold=True)
    else:
        click.secho("Workflow finished successfully", fg="green", bold=True)


def print_profiler_status(workflow) -> None:
    """
    Runs click echo to print the profiler workflow results
    """
    click.echo()
    click.secho("Source Status:", bold=True)
    click.echo(workflow.source_status.as_string())
    print_sink_status(workflow)

    if workflow.result_status() == 1:
        click.secho("Workflow finished with failures", fg="bright_red", bold=True)
    elif (
        workflow.source_status.warnings
        or workflow.status.failures
        or (hasattr(workflow, "sink") and workflow.sink.get_status().warnings)
    ):
        click.secho("Workflow finished with warnings", fg="yellow", bold=True)
    else:
        click.secho("Workflow finished successfully", fg="green", bold=True)


def print_test_suite_status(workflow) -> None:
    """
    Runs click echo to print the test suite workflow results
    """
    print_sink_status(workflow)

    if workflow.result_status() == 1:
        click.secho("Workflow finished with failures", fg="bright_red", bold=True)
    else:
        click.secho("Workflow finished successfully", fg="green", bold=True)
