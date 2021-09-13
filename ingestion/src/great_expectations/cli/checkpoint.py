import os
import sys
from typing import List

import click
from ruamel.yaml import YAML

from great_expectations import DataContext
from great_expectations.checkpoint.types.checkpoint_result import CheckpointResult
from great_expectations.cli import toolkit
from great_expectations.cli.pretty_printing import cli_message, cli_message_list
from great_expectations.data_context.util import file_relative_path
from great_expectations.exceptions import InvalidTopLevelConfigKeyError
from great_expectations.render.renderer.checkpoint_new_notebook_renderer import (
    CheckpointNewNotebookRenderer,
)
from great_expectations.util import lint_code

try:
    from sqlalchemy.exc import SQLAlchemyError
except ImportError:
    SQLAlchemyError = RuntimeError


try:
    from sqlalchemy.exc import SQLAlchemyError
except ImportError:
    SQLAlchemyError = RuntimeError

yaml = YAML()
yaml.indent(mapping=2, sequence=4, offset=2)


"""
--ge-feature-maturity-info--

    id: checkpoint_command_line
    title: LegacyCheckpoint - Command Line
    icon:
    short_description: Run a configured Checkpoint from a command line.
    description: Run a configured Checkpoint from a command line in a Terminal shell.
    how_to_guide_url: https://docs.greatexpectations.io/en/latest/guides/how_to_guides/validation/how_to_run_a_checkpoint_in_terminal.html
    maturity: Experimental
    maturity_details:
        api_stability: Unstable (expect changes to batch request)
        implementation_completeness: Complete
        unit_test_coverage: Complete
        integration_infrastructure_test_coverage: N/A
        documentation_completeness: Complete
        bug_risk: Low

--ge-feature-maturity-info--
"""


@click.group(short_help="Checkpoint operations")
@click.pass_context
def checkpoint(ctx):
    """
    Checkpoint operations

    A Checkpoint is a bundle of one or more batches of data with one or more
    Expectation Suites.

    A Checkpoint can be as simple as one batch of data paired with one
    Expectation Suite.

    A Checkpoint can be as complex as many batches of data across different
    datasources paired with one or more Expectation Suites each.
    """
    directory: str = toolkit.parse_cli_config_file_location(
        config_file_location=ctx.obj.config_file_location
    ).get("directory")
    context: DataContext = toolkit.load_data_context_with_error_handling(
        directory=directory,
        from_cli_upgrade_command=False,
    )
    # TODO consider moving this all the way up in to the CLIState constructor
    ctx.obj.data_context = context

    usage_stats_prefix = f"cli.checkpoint.{ctx.invoked_subcommand}"
    toolkit.send_usage_message(
        data_context=context,
        event=f"{usage_stats_prefix}.begin",
        success=True,
    )
    ctx.obj.usage_event_end = f"{usage_stats_prefix}.end"


@checkpoint.command(name="new")
@click.argument("name")
@click.option(
    "--jupyter/--no-jupyter",
    is_flag=True,
    help="By default launch jupyter notebooks unless you specify the --no-jupyter flag",
    default=True,
)
@click.pass_context
def checkpoint_new(ctx, name, jupyter):
    """Create a new Checkpoint for easy deployments.

    NAME is the name of the Checkpoint to create.
    """
    _checkpoint_new(ctx=ctx, checkpoint_name=name, jupyter=jupyter)


def _checkpoint_new(ctx, checkpoint_name, jupyter):

    context: DataContext = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end

    try:
        _verify_checkpoint_does_not_exist(context, checkpoint_name, usage_event_end)

        # Create notebook on disk
        notebook_name = f"edit_checkpoint_{checkpoint_name}.ipynb"
        notebook_file_path = _get_notebook_path(context, notebook_name)
        checkpoint_new_notebook_renderer = CheckpointNewNotebookRenderer(
            context=context, checkpoint_name=checkpoint_name
        )
        checkpoint_new_notebook_renderer.render_to_disk(
            notebook_file_path=notebook_file_path
        )

        if not jupyter:
            cli_message(
                f"To continue editing this Checkpoint, run <green>jupyter notebook {notebook_file_path}</green>"
            )

        toolkit.send_usage_message(context, event=usage_event_end, success=True)

        if jupyter:
            cli_message(
                """<green>Because you requested to create a new Checkpoint, we'll open a notebook for you now to edit it!
If you wish to avoid this you can add the `--no-jupyter` flag.</green>\n\n"""
            )
            toolkit.launch_jupyter_notebook(notebook_file_path)

    except Exception as e:
        toolkit.exit_with_failure_message_and_stats(
            data_context=context,
            usage_event=usage_event_end,
            message=f"<red>{e}</red>",
        )
        return


def _verify_checkpoint_does_not_exist(
    context: DataContext, checkpoint_name: str, usage_event: str
) -> None:
    try:
        if checkpoint_name in context.list_checkpoints():
            toolkit.exit_with_failure_message_and_stats(
                data_context=context,
                usage_event=usage_event,
                message=f"A Checkpoint named `{checkpoint_name}` already exists. Please choose a new name.",
            )
    except InvalidTopLevelConfigKeyError as e:
        toolkit.exit_with_failure_message_and_stats(
            data_context=context, usage_event=usage_event, message=f"<red>{e}</red>"
        )


def _get_notebook_path(context, notebook_name):
    return os.path.abspath(
        os.path.join(
            context.root_directory, context.GE_EDIT_NOTEBOOK_DIR, notebook_name
        )
    )


@checkpoint.command(name="list")
@click.pass_context
def checkpoint_list(ctx):
    """List configured checkpoints."""
    context: DataContext = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end

    checkpoints: List[str] = context.list_checkpoints()
    if not checkpoints:
        cli_message(
            "No Checkpoints found.\n"
            "  - Use the command `great_expectations checkpoint new` to create one."
        )
        toolkit.send_usage_message(context, event=usage_event_end, success=True)
        sys.exit(0)

    number_found: int = len(checkpoints)
    plural: str = "s" if number_found > 1 else ""
    message: str = f"Found {number_found} Checkpoint{plural}."
    pretty_list: list = [f" - <cyan>{cp}</cyan>" for cp in checkpoints]
    cli_message_list(pretty_list, list_intro_string=message)
    toolkit.send_usage_message(context, event=usage_event_end, success=True)


@checkpoint.command(name="delete")
@click.argument("checkpoint")
@click.pass_context
def checkpoint_delete(ctx, checkpoint):
    """Delete a Checkpoint."""
    context: DataContext = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end

    try:
        toolkit.delete_checkpoint(
            context=context,
            checkpoint_name=checkpoint,
            usage_event=usage_event_end,
            assume_yes=ctx.obj.assume_yes,
        )
        toolkit.send_usage_message(context, event=usage_event_end, success=True)
    except Exception as e:
        toolkit.exit_with_failure_message_and_stats(
            data_context=context,
            usage_event=usage_event_end,
            message=f"<red>{e}</red>",
        )
        return

    cli_message(f'Checkpoint "{checkpoint}" deleted.')
    sys.exit(0)


@checkpoint.command(name="run")
@click.argument("checkpoint")
@click.pass_context
def checkpoint_run(ctx, checkpoint):
    """Run a Checkpoint."""
    context: DataContext = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end

    try:
        result: CheckpointResult = toolkit.run_checkpoint(
            context=context,
            checkpoint_name=checkpoint,
            usage_event=usage_event_end,
        )
    except Exception as e:
        toolkit.exit_with_failure_message_and_stats(
            data_context=context,
            usage_event=usage_event_end,
            message=f"<red>{e}</red>",
        )
        return

    if not result["success"]:
        cli_message(string="Validation failed!")
        toolkit.send_usage_message(context, event=usage_event_end, success=True)
        print_validation_operator_results_details(result=result)
        sys.exit(1)

    cli_message("Validation succeeded!")
    toolkit.send_usage_message(context, event=usage_event_end, success=True)
    print_validation_operator_results_details(result=result)
    sys.exit(0)


def print_validation_operator_results_details(
    result: CheckpointResult,
) -> None:
    max_suite_display_width = 40
    cli_message(
        f"""
{'Suite Name'.ljust(max_suite_display_width)}     Status     Expectations met"""
    )
    for result_id, result_item in result.run_results.items():
        vr = result_item["validation_result"]
        stats = vr.statistics
        passed = stats["successful_expectations"]
        evaluated = stats["evaluated_expectations"]
        percentage_slug = (
            f"{round(passed / evaluated * 100, 2) if evaluated > 0 else 100} %"
        )
        stats_slug = f"{passed} of {evaluated} ({percentage_slug})"
        if vr.success:
            status_slug = "<green>✔ Passed</green>"
        else:
            status_slug = "<red>✖ Failed</red>"
        suite_name: str = str(vr.meta["expectation_suite_name"])
        if len(suite_name) > max_suite_display_width:
            suite_name = suite_name[0:max_suite_display_width]
            suite_name = suite_name[:-1] + "…"
        status_line: str = f"- {suite_name.ljust(max_suite_display_width)}   {status_slug}   {stats_slug}"
        cli_message(status_line)


@checkpoint.command(name="script")
@click.argument("checkpoint")
@click.pass_context
def checkpoint_script(ctx, checkpoint):
    """
    Create a python script to run a Checkpoint.

    Checkpoints can be run directly without this script using the
    `great_expectations Checkpoint run` command.

    This script is provided for those who wish to run Checkpoints via python.
    """
    context: DataContext = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end

    toolkit.validate_checkpoint(
        context=context, checkpoint_name=checkpoint, usage_event=usage_event_end
    )

    script_name: str = f"run_{checkpoint}.py"
    script_path: str = os.path.join(
        context.root_directory, context.GE_UNCOMMITTED_DIR, script_name
    )

    if os.path.isfile(script_path):
        toolkit.exit_with_failure_message_and_stats(
            data_context=context,
            usage_event=usage_event_end,
            message=f"""<red>Warning! A script named {script_name} already exists and this command will not overwrite it.</red>
  - Existing file path: {script_path}""",
        )

    _write_checkpoint_script_to_disk(
        context_directory=context.root_directory,
        checkpoint_name=checkpoint,
        script_path=script_path,
    )
    cli_message(
        f"""<green>A python script was created that runs the Checkpoint named: `{checkpoint}`</green>
  - The script is located in `great_expectations/uncommitted/run_{checkpoint}.py`
  - The script can be run with `python great_expectations/uncommitted/run_{checkpoint}.py`"""
    )
    toolkit.send_usage_message(context, event=usage_event_end, success=True)


def _write_checkpoint_script_to_disk(
    context_directory: str, checkpoint_name: str, script_path: str
) -> None:
    script_full_path: str = os.path.abspath(os.path.join(script_path))
    template: str = _load_script_template().format(checkpoint_name, context_directory)
    linted_code: str = lint_code(code=template)
    with open(script_full_path, "w") as f:
        f.write(linted_code)


def _load_script_template() -> str:
    with open(file_relative_path(__file__, "checkpoint_script_template.py")) as f:
        template = f.read()
    return template
