import json
import os
import sys

import click

from great_expectations import exceptions as ge_exceptions
from great_expectations.cli.v012 import toolkit
from great_expectations.cli.v012.datasource import get_batch_kwargs
from great_expectations.cli.v012.mark import Mark as mark
from great_expectations.cli.v012.util import cli_message, cli_message_list
from great_expectations.core.usage_statistics.usage_statistics import (
    edit_expectation_suite_usage_statistics,
)
from great_expectations.render.renderer.suite_edit_notebook_renderer import (
    SuiteEditNotebookRenderer,
)
from great_expectations.render.renderer.suite_scaffold_notebook_renderer import (
    SuiteScaffoldNotebookRenderer,
)

json_parse_exception = json.decoder.JSONDecodeError

try:
    from sqlalchemy.exc import SQLAlchemyError
except ImportError:
    # We'll redefine this error in code below to catch ProfilerError, which is caught above, so SA errors will
    # just fall through
    SQLAlchemyError = ge_exceptions.ProfilerError


@click.group()
def suite():
    """Expectation Suite operations"""
    pass


@suite.command(name="edit")
@click.argument("suite")
@click.option(
    "--datasource",
    "-ds",
    default=None,
    help="""The name of the datasource. The datasource must contain a single BatchKwargGenerator that can list data assets in the datasource """,
)
@click.option(
    "--batch-kwargs",
    default=None,
    help="""Batch_kwargs that specify the batch of data to be used a sample when editing the suite. Must be a valid JSON dictionary.
Make sure to escape quotes. Example: "{\"datasource\": \"my_db\", \"query\": \"select * from my_table\"}"
""",
)
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
@click.option(
    "--jupyter/--no-jupyter",
    is_flag=True,
    help="By default launch jupyter notebooks unless you specify the --no-jupyter flag",
    default=True,
)
def suite_edit(suite, datasource, directory, jupyter, batch_kwargs):
    """
    Generate a Jupyter notebook for editing an existing Expectation Suite.

    The SUITE argument is required. This is the name you gave to the suite
    when you created it.

    A batch of data is required to edit the suite, which is used as a sample.

    The edit command will help you specify a batch interactively. Or you can
    specify them manually by providing --batch-kwargs in valid JSON format.

    Read more about specifying batches of data in the documentation: https://docs.greatexpectations.io/
    """
    _suite_edit(
        suite,
        datasource,
        directory,
        jupyter,
        batch_kwargs,
        usage_event="cli.suite.edit",
    )


def _suite_edit(
    suite,
    datasource,
    directory,
    jupyter,
    batch_kwargs,
    usage_event,
    suppress_usage_message=False,
):
    # suppress_usage_message flag is for the situation where _suite_edit is called by _suite_new().
    # when called by _suite_new(), the flag will be set to False, otherwise it will default to True
    batch_kwargs_json = batch_kwargs
    batch_kwargs = None
    context = toolkit.load_data_context_with_error_handling(directory)

    try:
        suite = toolkit.load_expectation_suite(context, suite, usage_event)
        citations = suite.get_citations(require_batch_kwargs=True)

        if batch_kwargs_json:
            try:
                batch_kwargs = json.loads(batch_kwargs_json)
                if datasource:
                    batch_kwargs["datasource"] = datasource
                _batch = toolkit.load_batch(context, suite, batch_kwargs)
            except json_parse_exception as je:
                cli_message(
                    "<red>Please check that your batch_kwargs are valid JSON.\n{}</red>".format(
                        je
                    )
                )
                if not suppress_usage_message:
                    toolkit.send_usage_message(
                        data_context=context, event=usage_event, success=False
                    )
                sys.exit(1)
            except ge_exceptions.DataContextError:
                cli_message(
                    "<red>Please check that your batch_kwargs are able to load a batch.</red>"
                )
                if not suppress_usage_message:
                    toolkit.send_usage_message(
                        data_context=context, event=usage_event, success=False
                    )
                sys.exit(1)
            except ValueError as ve:
                cli_message(
                    "<red>Please check that your batch_kwargs are able to load a batch.\n{}</red>".format(
                        ve
                    )
                )
                if not suppress_usage_message:
                    toolkit.send_usage_message(
                        data_context=context, event=usage_event, success=False
                    )
                sys.exit(1)
        elif citations:
            citation = citations[-1]
            batch_kwargs = citation.get("batch_kwargs")

        if not batch_kwargs:
            cli_message(
                """
A batch of data is required to edit the suite - let's help you to specify it."""
            )

            additional_batch_kwargs = None
            try:
                data_source = toolkit.select_datasource(
                    context, datasource_name=datasource
                )
            except ValueError as ve:
                cli_message(f"<red>{ve}</red>")
                toolkit.send_usage_message(
                    data_context=context, event=usage_event, success=False
                )
                sys.exit(1)

            if not data_source:
                cli_message("<red>No datasources found in the context.</red>")
                if not suppress_usage_message:
                    toolkit.send_usage_message(
                        data_context=context, event=usage_event, success=False
                    )
                sys.exit(1)

            if batch_kwargs is None:
                (
                    datasource_name,
                    batch_kwargs_generator,
                    data_asset,
                    batch_kwargs,
                ) = get_batch_kwargs(
                    context,
                    datasource_name=data_source.name,
                    batch_kwargs_generator_name=None,
                    data_asset_name=None,
                    additional_batch_kwargs=additional_batch_kwargs,
                )

        notebook_name = f"edit_{suite.expectation_suite_name}.ipynb"
        notebook_path = _get_notebook_path(context, notebook_name)
        SuiteEditNotebookRenderer.from_data_context(context).render_to_disk(
            suite, notebook_path, batch_kwargs
        )

        if not jupyter:
            cli_message(
                f"To continue editing this suite, run <green>jupyter notebook {notebook_path}</green>"
            )

        payload = edit_expectation_suite_usage_statistics(
            data_context=context, expectation_suite_name=suite.expectation_suite_name
        )

        if not suppress_usage_message:
            toolkit.send_usage_message(
                data_context=context,
                event=usage_event,
                event_payload=payload,
                success=True,
            )

        if jupyter:
            toolkit.launch_jupyter_notebook(notebook_path)

    except Exception as e:
        toolkit.send_usage_message(
            data_context=context, event=usage_event, success=False
        )
        raise e


@suite.command(name="demo")
@click.option("--suite", "-es", default=None, help="Expectation suite name.")
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
@click.option(
    "--view/--no-view",
    help="By default open in browser unless you specify the --no-view flag",
    default=True,
)
@mark.cli_as_beta
def suite_demo(suite, directory, view):
    """
    Create a new demo Expectation Suite.

    Great Expectations will choose a couple of columns and generate expectations
    about them to demonstrate some examples of assertions you can make about
    your data.
    """
    _suite_new(
        suite=suite,
        directory=directory,
        empty=False,
        jupyter=False,
        view=view,
        batch_kwargs=None,
        usage_event="cli.suite.demo",
    )


@suite.command(name="new")
@click.option("--suite", "-es", default=None, help="Expectation suite name.")
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
@click.option(
    "--jupyter/--no-jupyter",
    is_flag=True,
    help="By default launch jupyter notebooks unless you specify the --no-jupyter flag",
    default=True,
)
@click.option(
    "--batch-kwargs",
    default=None,
    help="Additional keyword arguments to be provided to get_batch when loading the data asset. Must be a valid JSON dictionary",
)
def suite_new(suite, directory, jupyter, batch_kwargs):
    """
    Create a new empty Expectation Suite.

    Edit in jupyter notebooks, or skip with the --no-jupyter flag
    """
    _suite_new(
        suite=suite,
        directory=directory,
        empty=True,
        jupyter=jupyter,
        view=False,
        batch_kwargs=batch_kwargs,
        usage_event="cli.suite.new",
    )


def _suite_new(
    suite: str,
    directory: str,
    empty: bool,
    jupyter: bool,
    view: bool,
    batch_kwargs,
    usage_event: str,
) -> None:
    # TODO break this up into demo and new
    context = toolkit.load_data_context_with_error_handling(directory)

    datasource_name = None
    generator_name = None
    data_asset_name = None

    try:
        if batch_kwargs is not None:
            batch_kwargs = json.loads(batch_kwargs)

        success, suite_name, profiling_results = toolkit.create_expectation_suite(
            context,
            datasource_name=datasource_name,
            batch_kwargs_generator_name=generator_name,
            data_asset_name=data_asset_name,
            batch_kwargs=batch_kwargs,
            expectation_suite_name=suite,
            additional_batch_kwargs={"limit": 1000},
            empty_suite=empty,
            show_intro_message=False,
            open_docs=view,
        )
        if success:
            if empty:
                if jupyter:
                    cli_message(
                        """<green>Because you requested an empty suite, we'll open a notebook for you now to edit it!
If you wish to avoid this you can add the `--no-jupyter` flag.</green>\n\n"""
                    )
            toolkit.send_usage_message(
                data_context=context, event=usage_event, success=True
            )

            _suite_edit(
                suite_name,
                datasource_name,
                directory,
                jupyter=jupyter,
                batch_kwargs=batch_kwargs,
                usage_event="cli.suite.edit",  # or else we will be sending `cli.suite.new` which is incorrect
                suppress_usage_message=True,  # dont want actually send usage_message since the function call is not the result of actual usage
            )
        else:
            toolkit.send_usage_message(
                data_context=context, event=usage_event, success=False
            )
    except (
        ge_exceptions.DataContextError,
        ge_exceptions.ProfilerError,
        OSError,
        SQLAlchemyError,
    ) as e:
        cli_message(f"<red>{e}</red>")
        toolkit.send_usage_message(
            data_context=context, event=usage_event, success=False
        )
        sys.exit(1)
    except Exception as e:
        toolkit.send_usage_message(
            data_context=context, event=usage_event, success=False
        )
        raise e


@suite.command(name="delete")
@click.argument("suite")
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
@mark.cli_as_experimental
def suite_delete(suite, directory):
    """
    Delete an expectation suite from the expectation store.
    """
    usage_event = "cli.suite.delete"
    context = toolkit.load_data_context_with_error_handling(directory)
    suite_names = context.list_expectation_suite_names()
    if not suite_names:
        toolkit.exit_with_failure_message_and_stats(
            context,
            usage_event,
            "</red>No expectation suites found in the project.</red>",
        )

    if suite not in suite_names:
        toolkit.exit_with_failure_message_and_stats(
            context, usage_event, f"No expectation suite named {suite} found."
        )

    context.delete_expectation_suite(suite)
    cli_message(f"Deleted the expectation suite named: {suite}")
    toolkit.send_usage_message(data_context=context, event=usage_event, success=True)


@suite.command(name="scaffold")
@click.argument("suite")
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
@click.option(
    "--jupyter/--no-jupyter",
    is_flag=True,
    help="By default launch jupyter notebooks unless you specify the --no-jupyter flag",
    default=True,
)
@mark.cli_as_experimental
def suite_scaffold(suite, directory, jupyter):
    """Scaffold a new Expectation Suite."""
    _suite_scaffold(suite, directory, jupyter)


def _suite_scaffold(suite: str, directory: str, jupyter: bool) -> None:
    usage_event = "cli.suite.scaffold"
    suite_name = suite
    context = toolkit.load_data_context_with_error_handling(directory)
    notebook_filename = f"scaffold_{suite_name}.ipynb"
    notebook_path = _get_notebook_path(context, notebook_filename)

    if suite_name in context.list_expectation_suite_names():
        toolkit.tell_user_suite_exists(suite_name)
        if os.path.isfile(notebook_path):
            cli_message(
                f"  - If you wish to adjust your scaffolding, you can open this notebook with jupyter: `{notebook_path}` <red>(Please note that if you run that notebook, you will overwrite your existing suite.)</red>"
            )
        toolkit.send_usage_message(
            data_context=context, event=usage_event, success=False
        )
        sys.exit(1)

    datasource = toolkit.select_datasource(context)
    if datasource is None:
        toolkit.send_usage_message(
            data_context=context, event=usage_event, success=False
        )
        sys.exit(1)

    _suite = context.create_expectation_suite(suite_name)
    _, _, _, batch_kwargs = get_batch_kwargs(context, datasource_name=datasource.name)
    renderer = SuiteScaffoldNotebookRenderer(context, _suite, batch_kwargs)
    renderer.render_to_disk(notebook_path)

    toolkit.send_usage_message(data_context=context, event=usage_event, success=True)

    if jupyter:
        toolkit.launch_jupyter_notebook(notebook_path)
    else:
        cli_message(
            f"To continue scaffolding this suite, run `jupyter notebook {notebook_path}`"
        )


@suite.command(name="list")
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
def suite_list(directory):
    """Lists available Expectation Suites."""
    context = toolkit.load_data_context_with_error_handling(directory)

    try:
        suite_names = [
            f" - <cyan>{suite_name}</cyan>"
            for suite_name in context.list_expectation_suite_names()
        ]
        if len(suite_names) == 0:
            cli_message("No Expectation Suites found")
            toolkit.send_usage_message(
                data_context=context, event="cli.suite.list", success=True
            )
            return
        elif len(suite_names) == 1:
            list_intro_string = "1 Expectation Suite found:"
        else:
            list_intro_string = f"{len(suite_names)} Expectation Suites found:"

        cli_message_list(suite_names, list_intro_string)
        toolkit.send_usage_message(
            data_context=context, event="cli.suite.list", success=True
        )
    except Exception as e:
        toolkit.send_usage_message(
            data_context=context, event="cli.suite.list", success=False
        )
        raise e


def _get_notebook_path(context, notebook_name):
    return os.path.abspath(
        os.path.join(
            context.root_directory, context.GE_EDIT_NOTEBOOK_DIR, notebook_name
        )
    )
