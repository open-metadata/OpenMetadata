import copy
import os
import sys
from typing import Any, Dict, List, Optional, Union

import click

from great_expectations import DataContext
from great_expectations import exceptions as ge_exceptions
from great_expectations.cli import toolkit
from great_expectations.cli.mark import Mark as mark
from great_expectations.cli.pretty_printing import cli_message, cli_message_list
from great_expectations.core import ExpectationSuite
from great_expectations.core.batch import BatchRequest
from great_expectations.core.usage_statistics.usage_statistics import (
    edit_expectation_suite_usage_statistics,
)
from great_expectations.render.renderer.v3.suite_edit_notebook_renderer import (
    SuiteEditNotebookRenderer,
)
from great_expectations.render.renderer.v3.suite_profile_notebook_renderer import (
    SuiteProfileNotebookRenderer,
)

try:
    from sqlalchemy.exc import SQLAlchemyError
except ImportError:
    # We'll redefine this error in code below to catch ProfilerError, which is caught above, so SA errors will
    # just fall through
    SQLAlchemyError = ge_exceptions.ProfilerError


@click.group()
@click.pass_context
def suite(ctx):
    """Expectation Suite operations"""
    directory: str = toolkit.parse_cli_config_file_location(
        config_file_location=ctx.obj.config_file_location
    ).get("directory")
    context: DataContext = toolkit.load_data_context_with_error_handling(
        directory=directory,
        from_cli_upgrade_command=False,
    )
    # TODO consider moving this all the way up in to the CLIState constructor
    ctx.obj.data_context = context

    usage_stats_prefix = f"cli.suite.{ctx.invoked_subcommand}"
    toolkit.send_usage_message(
        data_context=context,
        event=f"{usage_stats_prefix}.begin",
        success=True,
    )
    ctx.obj.usage_event_end = f"{usage_stats_prefix}.end"


@suite.command(name="new")
@click.option(
    "--expectation-suite",
    "-e",
    default=None,
    help="Expectation suite name.",
)
@click.option(
    "--interactive",
    "-i",
    "interactive_flag",
    is_flag=True,
    default=False,
    help="""Use a batch of data to create expectations against (interactive mode).
""",
)
@click.option(
    "--manual",
    "-m",
    "manual_flag",
    is_flag=True,
    default=False,
    help="""Do not use a batch of data to create expectations against (manual mode).
""",
)
@click.option(
    "--profile",
    "-p",
    is_flag=True,
    default=False,
    help="""Generate a starting expectation suite automatically so you can refine it further. Assumes --interactive
flag.
""",
)
@click.option(
    "--batch-request",
    "-br",
    help="""Arguments to be provided to get_batch when loading the data asset.  Must be a path to a valid JSON file.
Assumes --interactive flag.
""",
    default=None,
)
@click.option(
    "--no-jupyter",
    "-nj",
    is_flag=True,
    default=False,
    help="By default launch jupyter notebooks, unless you specify --no-jupyter flag.",
)
@click.pass_context
def suite_new(
    ctx,
    expectation_suite,
    interactive_flag,
    manual_flag,
    profile,
    batch_request,
    no_jupyter,
):
    """
    Create a new Expectation Suite.
    Edit in jupyter notebooks, or skip with the --no-jupyter flag.
    """
    context: DataContext = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end

    processed_flags: Dict[str, Optional[bool]] = _process_suite_new_flags_and_prompt(
        context=context,
        usage_event_end=usage_event_end,
        interactive_flag=interactive_flag,
        manual_flag=manual_flag,
        profile=profile,
        batch_request=batch_request,
    )

    _suite_new_workflow(
        context=context,
        expectation_suite_name=expectation_suite,
        interactive=processed_flags["interactive"],
        profile=processed_flags["profile"],
        no_jupyter=no_jupyter,
        usage_event=usage_event_end,
        batch_request=batch_request,
    )


def _process_suite_new_flags_and_prompt(
    context: DataContext,
    usage_event_end: str,
    interactive_flag: bool,
    manual_flag: bool,
    profile: bool,
    batch_request: Optional[str] = None,
) -> Dict[str, Optional[bool]]:
    """
    Process various optional suite new flags and prompt if there is not enough information from the flags.
    Args:
        context: Data Context for use in sending error messages if any
        usage_event_end: event name for ending usage stats message
        interactive_flag: --interactive from the `suite new` CLI command
        manual_flag: --manual from the `suite new` CLI command
        profile: --profile from the `suite new` CLI command
        batch_request: --batch-request from the `suite new` CLI command

    Returns:
        Dictionary with keys of processed parameters and boolean values e.g.
        {"interactive": True, "profile": False}
    """

    error_message: Optional[str] = None

    # Convert interactive / no-interactive flags to interactive
    interactive: Optional[bool] = None
    if interactive_flag is True and manual_flag is True:
        error_message = """Please choose either --interactive or --manual, you may not choose both."""
    elif interactive_flag is False and manual_flag is False:
        interactive = None
    elif interactive_flag is True and manual_flag is False:
        interactive = True
    elif interactive_flag is False and manual_flag is True:
        interactive = False

    if error_message is not None:
        cli_message(string=f"<red>{error_message}</red>")
        toolkit.send_usage_message(
            data_context=context, event=usage_event_end, success=False
        )
        sys.exit(1)

    user_provided_any_flag_skip_prompt: bool = any(
        ((interactive is not None), (profile is True), (batch_request is not None))
    )

    # Note - explicit check for boolean or None for `interactive: Optional[bool]` is necessary because None indicates
    #  that a user did not supply either flag.
    if user_provided_any_flag_skip_prompt:
        # Assume batch needed if user passes --profile
        if profile and interactive is None:
            cli_message(
                "<green>Entering interactive mode since you passed the --profile flag</green>"
            )
            interactive = True
        elif profile and interactive is False:
            cli_message(
                "<yellow>Warning: Ignoring the --manual flag and entering interactive mode since you passed the --profile flag</yellow>"
            )
            interactive = True
        # Assume batch needed if user passes --batch-request
        elif (batch_request is not None) and (interactive is None):
            cli_message(
                "<green>Entering interactive mode since you passed the --batch-request flag</green>"
            )
            interactive = True
        elif (batch_request is not None) and (interactive is False):
            cli_message(
                "<yellow>Warning: Ignoring the --manual flag and entering interactive mode since you passed the --batch-request flag</yellow>"
            )
            interactive = True
    else:
        suite_create_method: str = click.prompt(
            """
How would you like to create your Expectation Suite?
    1. Manually, without interacting with a sample batch of data (default)
    2. Interactively, with a sample batch of data
    3. Automatically, using a profiler
""",
            type=click.Choice(["1", "2", "3"]),
            show_choices=False,
            default="1",
            show_default=False,
        )
        # Default option
        if suite_create_method == "":
            interactive = False
            profile = False
        elif suite_create_method == "1":
            interactive = False
            profile = False
        elif suite_create_method == "2":
            interactive = True
            profile = False
        elif suite_create_method == "3":
            interactive = True
            profile = True

    return {"interactive": interactive, "profile": profile}


def _suite_new_workflow(
    context: DataContext,
    expectation_suite_name: str,
    interactive: bool,
    profile: bool,
    no_jupyter: bool,
    usage_event: str,
    batch_request: Optional[
        Union[str, Dict[str, Union[str, int, Dict[str, Any]]]]
    ] = None,
):
    try:
        datasource_name: Optional[str] = None
        data_asset_name: Optional[str] = None

        additional_batch_request_args: Optional[
            Dict[str, Union[str, int, Dict[str, Any]]]
        ] = {"limit": 1000}

        if interactive:
            if batch_request is not None and isinstance(batch_request, str):
                batch_request = toolkit.get_batch_request_from_json_file(
                    batch_request_json_file_path=batch_request,
                    data_context=context,
                    usage_event=usage_event,
                    suppress_usage_message=False,
                )

            if not batch_request:
                batch_request = toolkit.get_batch_request_using_datasource_name(
                    data_context=context,
                    datasource_name=datasource_name,
                    usage_event=usage_event,
                    suppress_usage_message=False,
                    additional_batch_request_args=additional_batch_request_args,
                )
                # In this case, we have "consumed" the additional_batch_request_args
                additional_batch_request_args = {}

            data_asset_name = batch_request.get("data_asset_name")
        else:
            batch_request = None

        suite: ExpectationSuite = toolkit.get_or_create_expectation_suite(
            expectation_suite_name=expectation_suite_name,
            data_context=context,
            data_asset_name=data_asset_name,
            usage_event=usage_event,
            suppress_usage_message=False,
            batch_request=batch_request,
            create_if_not_exist=True,
        )
        expectation_suite_name = suite.expectation_suite_name

        toolkit.add_citation_with_batch_request(
            data_context=context,
            expectation_suite=suite,
            batch_request=batch_request,
        )

        toolkit.send_usage_message(
            data_context=context, event=usage_event, success=True
        )

        if batch_request:
            datasource_name = batch_request.get("datasource_name")

        # This usage event is suppressed via suppress_usage_message but here because usage_event is not optional
        usage_event = "cli.suite.edit.begin"  # or else we will be sending `cli.suite.new` which is incorrect
        # do not want to actually send usage_message, since the function call is not the result of actual usage
        _suite_edit_workflow(
            context=context,
            expectation_suite_name=expectation_suite_name,
            profile=profile,
            usage_event=usage_event,
            interactive=interactive,
            no_jupyter=no_jupyter,
            create_if_not_exist=True,
            datasource_name=datasource_name,
            batch_request=batch_request,
            additional_batch_request_args=additional_batch_request_args,
            suppress_usage_message=True,
            assume_yes=False,
        )
    except (
        ge_exceptions.DataContextError,
        ge_exceptions.ProfilerError,
        ValueError,
        OSError,
        SQLAlchemyError,
    ) as e:
        cli_message(string=f"<red>{e}</red>")
        toolkit.send_usage_message(
            data_context=context, event=usage_event, success=False
        )
        sys.exit(1)
    except Exception as e:
        toolkit.send_usage_message(
            data_context=context, event=usage_event, success=False
        )
        raise e


@suite.command(name="edit")
@click.argument("expectation_suite")
@click.option(
    "--interactive",
    "-i",
    "interactive_flag",
    is_flag=True,
    default=False,
    help="""Allows to specify explicitly whether or not a batch of data is available to reason about using the language
of expectations; otherwise, best effort is made to determine this automatically (falling back to False).  Assumed with
--datasource-name option and with --batch-request option.
""",
)
@click.option(
    "--manual",
    "-m",
    "manual_flag",
    is_flag=True,
    default=False,
    help="""Do not use a batch of data to create expectations against(manual mode).
""",
)
@click.option(
    "--datasource-name",
    "-ds",
    default=None,
    help="""The name of the datasource. Assumes --interactive flag.  Incompatible with --batch-request option.
""",
)
@click.option(
    "--batch-request",
    "-br",
    help="""Arguments to be provided to get_batch when loading the data asset.  Must be a path to a valid JSON file.
Assumes --interactive flag.  Incompatible with --datasource-name option.
""",
    default=None,
)
@click.option(
    "--no-jupyter",
    "-nj",
    is_flag=True,
    default=False,
    help="By default launch jupyter notebooks, unless you specify --no-jupyter flag.",
)
@click.pass_context
def suite_edit(
    ctx,
    expectation_suite,
    interactive_flag,
    manual_flag,
    datasource_name,
    batch_request,
    no_jupyter,
):
    """
    Edit an existing Expectation Suite.

    The SUITE argument is required. This is the name you gave to the suite
    when you created it.

    The edit command will help you specify a batch interactively. Or you can
    specify them manually by providing --batch-request in valid JSON format.

    Read more about specifying batches of data in the documentation: https://docs.greatexpectations.io/
    """
    context: DataContext = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end

    interactive: bool = _process_suite_edit_flags_and_prompt(
        context=context,
        usage_event_end=usage_event_end,
        interactive_flag=interactive_flag,
        manual_flag=manual_flag,
        datasource_name=datasource_name,
        batch_request=batch_request,
    )

    additional_batch_request_args: Optional[
        Dict[str, Union[str, int, Dict[str, Any]]]
    ] = {"limit": 1000}

    _suite_edit_workflow(
        context=context,
        expectation_suite_name=expectation_suite,
        profile=False,
        usage_event=usage_event_end,
        interactive=interactive,
        no_jupyter=no_jupyter,
        create_if_not_exist=False,
        datasource_name=datasource_name,
        batch_request=batch_request,
        additional_batch_request_args=additional_batch_request_args,
        suppress_usage_message=False,
        assume_yes=False,
    )


def _process_suite_edit_flags_and_prompt(
    context: DataContext,
    usage_event_end: str,
    interactive_flag: bool,
    manual_flag: bool,
    datasource_name: Optional[str] = None,
    batch_request: Optional[str] = None,
) -> bool:
    """
    Process various optional suite edit flags and prompt if there is not enough information from the flags.
    Args:
        context: Data Context for use in sending error messages if any
        usage_event_end: event name for ending usage stats message
        interactive_flag: --interactive from the `suite new` CLI command
        manual_flag: --manual from the `suite new` CLI command
        datasource_name: --datasource-name from the `suite new` CLI command
        batch_request: --batch-request from the `suite new` CLI command

    Returns:
        boolean of whether to enter interactive mode
    """

    error_message: Optional[str] = None

    # Convert interactive / no-interactive flags to interactive
    interactive: Optional[bool] = None
    if interactive_flag is True and manual_flag is True:
        error_message = """Please choose either --interactive or --manual, you may not choose both."""
    elif interactive_flag is False and manual_flag is False:
        interactive = None
    elif interactive_flag is True and manual_flag is False:
        interactive = True
    elif interactive_flag is False and manual_flag is True:
        interactive = False

    if (datasource_name is not None) and (batch_request is not None):
        error_message = """Only one of --datasource-name DATASOURCE_NAME and --batch-request <path to JSON file> \
options can be used.
"""

    if error_message is not None:
        cli_message(string=f"<red>{error_message}</red>")
        toolkit.send_usage_message(
            data_context=context, event=usage_event_end, success=False
        )
        sys.exit(1)

    user_provided_any_flag_skip_prompt: bool = any(
        (
            (interactive is not None),
            (datasource_name is not None),
            (batch_request is not None),
        )
    )

    # Note - explicit check for boolean or None for `interactive: Optional[bool]` is necessary because None indicates
    #  that a user did not supply either flag.
    if user_provided_any_flag_skip_prompt:
        if datasource_name is not None:
            if interactive is None:
                cli_message(
                    "<green>Entering interactive mode since you passed the --datasource-name flag</green>"
                )
            elif interactive is False:
                cli_message(
                    "<yellow>Warning: Ignoring the --manual flag and entering interactive mode since you passed the --datasource-name flag</yellow>"
                )
            interactive = True
        elif batch_request is not None:
            if interactive is None:
                cli_message(
                    "<green>Entering interactive mode since you passed the --batch-request flag</green>"
                )
            elif interactive is False:
                cli_message(
                    "<yellow>Warning: Ignoring the --manual flag and entering interactive mode since you passed the --batch-request flag</yellow>"
                )
            interactive = True
    else:
        suite_edit_method: str = click.prompt(
            """
How would you like to edit your Expectation Suite?
    1. Manually, without interacting with a sample batch of data (default)
    2. Interactively, with a sample batch of data
""",
            type=click.Choice(["1", "2"]),
            show_choices=False,
            default="1",
            show_default=False,
        )
        # Default option
        if suite_edit_method == "":
            interactive = False
        if suite_edit_method == "1":
            interactive = False
        elif suite_edit_method == "2":
            interactive = True

    return interactive


def _suite_edit_workflow(
    context: DataContext,
    expectation_suite_name: str,
    profile: bool,
    usage_event: str,
    interactive: bool,
    no_jupyter: bool,
    create_if_not_exist: Optional[bool] = False,
    datasource_name: Optional[str] = None,
    batch_request: Optional[
        Union[str, Dict[str, Union[str, int, Dict[str, Any]]]]
    ] = None,
    additional_batch_request_args: Optional[
        Dict[str, Union[str, int, Dict[str, Any]]]
    ] = None,
    suppress_usage_message: Optional[bool] = False,
    assume_yes: Optional[bool] = False,
):
    # suppress_usage_message flag is for the situation where _suite_edit_workflow is called by _suite_new_workflow().
    # when called by _suite_new_workflow(), the flag will be set to True, otherwise it will default to False
    if suppress_usage_message:
        usage_event = None

    suite: ExpectationSuite = toolkit.load_expectation_suite(
        data_context=context,
        expectation_suite_name=expectation_suite_name,
        usage_event=usage_event,
        create_if_not_exist=create_if_not_exist,
    )

    try:
        if interactive or profile:
            batch_request_from_citation_is_up_to_date: bool = True

            batch_request_from_citation: Optional[
                Union[str, Dict[str, Union[str, Dict[str, Any]]]]
            ] = toolkit.get_batch_request_from_citations(expectation_suite=suite)

            if batch_request is not None and isinstance(batch_request, str):
                batch_request = toolkit.get_batch_request_from_json_file(
                    batch_request_json_file_path=batch_request,
                    data_context=context,
                    usage_event=usage_event,
                    suppress_usage_message=suppress_usage_message,
                )
                if batch_request != batch_request_from_citation:
                    batch_request_from_citation_is_up_to_date = False

            if not (
                batch_request
                and isinstance(batch_request, dict)
                and BatchRequest(**batch_request)
            ):
                if (
                    batch_request_from_citation
                    and isinstance(batch_request_from_citation, dict)
                    and BatchRequest(**batch_request_from_citation)
                ):
                    batch_request = copy.deepcopy(batch_request_from_citation)
                else:
                    batch_request = toolkit.get_batch_request_using_datasource_name(
                        data_context=context,
                        datasource_name=datasource_name,
                        usage_event=usage_event,
                        suppress_usage_message=False,
                        additional_batch_request_args=additional_batch_request_args,
                    )
                    if batch_request != batch_request_from_citation:
                        batch_request_from_citation_is_up_to_date = False

            if not batch_request_from_citation_is_up_to_date:
                toolkit.add_citation_with_batch_request(
                    data_context=context,
                    expectation_suite=suite,
                    batch_request=batch_request,
                )

        notebook_name: str = f"edit_{expectation_suite_name}.ipynb"
        notebook_path: str = _get_notebook_path(context, notebook_name)

        if profile:
            if not assume_yes:
                toolkit.prompt_profile_to_create_a_suite(
                    data_context=context, expectation_suite_name=expectation_suite_name
                )

            renderer: SuiteProfileNotebookRenderer = SuiteProfileNotebookRenderer(
                context=context,
                expectation_suite_name=expectation_suite_name,
                batch_request=batch_request,
            )
            renderer.render_to_disk(notebook_file_path=notebook_path)
        else:
            SuiteEditNotebookRenderer.from_data_context(
                data_context=context
            ).render_to_disk(
                suite=suite,
                notebook_file_path=notebook_path,
                batch_request=batch_request,
            )

        if no_jupyter:
            cli_message(
                string=f"To continue editing this suite, run <green>jupyter notebook {notebook_path}</green>"
            )
        else:
            cli_message(
                string="""<green>Opening a notebook for you now to edit your expectation suite!
If you wish to avoid this you can add the `--no-jupyter` flag.</green>\n\n"""
            )

        payload: dict = edit_expectation_suite_usage_statistics(
            data_context=context, expectation_suite_name=suite.expectation_suite_name
        )

        if not suppress_usage_message:
            toolkit.send_usage_message(
                data_context=context,
                event=usage_event,
                event_payload=payload,
                success=True,
            )

        if not no_jupyter:
            toolkit.launch_jupyter_notebook(notebook_path=notebook_path)

    except (
        ge_exceptions.DataContextError,
        ge_exceptions.ProfilerError,
        ValueError,
        OSError,
        SQLAlchemyError,
    ) as e:
        cli_message(string=f"<red>{e}</red>")
        if not suppress_usage_message:
            toolkit.send_usage_message(
                data_context=context, event=usage_event, success=False
            )
        sys.exit(1)

    except Exception as e:
        if not suppress_usage_message:
            toolkit.send_usage_message(
                data_context=context, event=usage_event, success=False
            )
        raise e


@mark.cli_as_deprecation
@suite.command(name="demo")
@click.pass_context
def suite_demo(ctx):
    """This command is not supported in the v3 (Batch Request) API."""
    context: DataContext = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end
    toolkit.send_usage_message(
        data_context=context, event=usage_event_end, success=True
    )
    cli_message(
        string="This command is not supported in the v3 (Batch Request) API. Please use `suite new` instead."
    )


@suite.command(name="delete")
@click.argument("suite")
@click.pass_context
def suite_delete(ctx, suite):
    """
    Delete an Expectation Suite from the Expectation Store.
    """
    context: DataContext = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end
    try:
        suite_names: List[str] = context.list_expectation_suite_names()
    except Exception as e:
        toolkit.send_usage_message(
            data_context=context, event=usage_event_end, success=False
        )
        raise e
    if not suite_names:
        toolkit.exit_with_failure_message_and_stats(
            data_context=context,
            usage_event=usage_event_end,
            suppress_usage_message=False,
            message="<red>No expectation suites found in the project.</red>",
        )

    if suite not in suite_names:
        toolkit.exit_with_failure_message_and_stats(
            data_context=context,
            usage_event=usage_event_end,
            suppress_usage_message=False,
            message=f"<red>No expectation suite named {suite} found.</red>",
        )

    if not (
        ctx.obj.assume_yes
        or toolkit.confirm_proceed_or_exit(
            exit_on_no=False, data_context=context, usage_stats_event=usage_event_end
        )
    ):
        cli_message(string=f"Suite `{suite}` was not deleted.")
        sys.exit(0)

    context.delete_expectation_suite(suite)
    cli_message(string=f"Deleted the expectation suite named: {suite}")
    toolkit.send_usage_message(
        data_context=context, event=usage_event_end, success=True
    )


@suite.command(name="list")
@click.pass_context
def suite_list(ctx):
    """List existing Expectation Suites."""
    context: DataContext = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end
    try:
        suite_names: List[str] = context.list_expectation_suite_names()
    except Exception as e:
        toolkit.send_usage_message(
            data_context=context, event=usage_event_end, success=False
        )
        raise e

    suite_names_styled: List[str] = [
        f" - <cyan>{suite_name}</cyan>" for suite_name in suite_names
    ]
    if len(suite_names_styled) == 0:
        cli_message(string="No Expectation Suites found")
        toolkit.send_usage_message(
            data_context=context, event=usage_event_end, success=True
        )
        return

    list_intro_string: str
    if len(suite_names_styled) == 1:
        list_intro_string = "1 Expectation Suite found:"
    else:
        list_intro_string = f"{len(suite_names_styled)} Expectation Suites found:"
    cli_message_list(
        string_list=suite_names_styled, list_intro_string=list_intro_string
    )
    toolkit.send_usage_message(
        data_context=context, event=usage_event_end, success=True
    )


def _get_notebook_path(context, notebook_name):
    return os.path.abspath(
        os.path.join(
            context.root_directory, context.GE_EDIT_NOTEBOOK_DIR, notebook_name
        )
    )
