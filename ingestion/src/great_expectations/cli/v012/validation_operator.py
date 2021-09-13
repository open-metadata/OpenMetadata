import datetime
import json
import sys

import click

from great_expectations import DataContext
from great_expectations import exceptions as ge_exceptions
from great_expectations.cli.v012 import toolkit
from great_expectations.cli.v012.datasource import get_batch_kwargs
from great_expectations.cli.v012.mark import Mark as mark
from great_expectations.cli.v012.util import cli_message, cli_message_dict
from great_expectations.core.run_identifier import RunIdentifier

json_parse_exception = json.decoder.JSONDecodeError

try:
    from sqlalchemy.exc import SQLAlchemyError
except ImportError:
    # We'll redefine this error in code below to catch ProfilerError, which is caught above, so SA errors will
    # just fall through
    SQLAlchemyError = ge_exceptions.ProfilerError


@click.group()
def validation_operator():
    """Validation Operator operations"""
    pass


@validation_operator.command(name="list")
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
@mark.cli_as_experimental
def validation_operator_list(directory):
    """List known Validation Operators."""
    try:
        context = DataContext(directory)
    except ge_exceptions.ConfigNotFoundError as err:
        cli_message(f"<red>{err.message}</red>")
        return

    try:
        validation_operators = context.list_validation_operators()

        if len(validation_operators) == 0:
            cli_message("No Validation Operators found")
            return
        elif len(validation_operators) == 1:
            list_intro_string = "1 Validation Operator found:"
        else:
            list_intro_string = "{} Validation Operators found:".format(
                len(validation_operators)
            )

        cli_message(list_intro_string)
        for validation_operator in validation_operators:
            cli_message("")
            cli_message_dict(validation_operator)
        toolkit.send_usage_message(
            data_context=context, event="cli.validation_operator.list", success=True
        )
    except Exception as e:
        toolkit.send_usage_message(
            data_context=context, event="cli.validation_operator.list", success=False
        )
        raise e


@validation_operator.command(name="run")
@click.option(
    "--validation_config_file",
    "-f",
    default=None,
    help="""The path of the validation config file (JSON). """,
)
@click.option(
    "--name",
    "-n",
    default=None,
    help="""The name of the validation operator. """,
)
@click.option(
    "--suite",
    "-s",
    default=None,
    help="""The name of the expectation suite. """,
)
@click.option(
    "--run_name",
    "-r",
    default=None,
    help="""Run name. If not specified, a timestamp-based run id will be automatically generated. """,
)
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
@mark.cli_as_deprecation(
    """<yellow>In the next major release this command will be deprecated.
Please consider using either:
  - `checkpoint new` if you wish to configure a new checkpoint interactively
  - `checkpoint run` if you wish to run a saved checkpoint</yellow>"""
)
def validation_operator_run(name, run_name, validation_config_file, suite, directory):
    # Note though the long lines here aren't pythonic, they look best if Click does the line wraps.
    """
    Run a validation operator against some data.

    There are two modes to run this command:

    1. Interactive (good for development):

        Specify the name of the validation operator using the --name argument
        and the name of the expectation suite using the --suite argument.

        The cli will help you specify the batch of data that you want to
        validate interactively.


    2. Non-interactive (good for production):

        Use the `--validation_config_file` argument to specify the path of the validation configuration JSON file. This file can be used to instruct a validation operator to validate multiple batches of data and use multiple expectation suites to validate each batch.

        Learn how to create a validation config file here:
        https://great-expectations.readthedocs.io/en/latest/command_line.html#great-expectations-validation-operator-run-validation-config-file-validation-config-file-path

        This command exits with 0 if the validation operator ran and the "success" attribute in its return object is True. Otherwise, the command exits with 1.

    To learn more about validation operators, go here:
    https://great-expectations.readthedocs.io/en/latest/features/validation.html#validation-operators
    """

    try:
        context = DataContext(directory)
    except ge_exceptions.ConfigNotFoundError as err:
        cli_message(f"Failed to process <red>{err.message}</red>")
        sys.exit(1)

    try:
        if validation_config_file is not None:
            try:
                with open(validation_config_file) as f:
                    validation_config = json.load(f)
            except (OSError, json_parse_exception) as e:
                cli_message(
                    f"Failed to process the --validation_config_file argument: <red>{e}</red>"
                )
                toolkit.send_usage_message(
                    data_context=context,
                    event="cli.validation_operator.run",
                    success=False,
                )
                sys.exit(1)

            validation_config_error_message = _validate_valdiation_config(
                validation_config
            )
            if validation_config_error_message is not None:
                cli_message(
                    "<red>The validation config in {:s} is misconfigured: {:s}</red>".format(
                        validation_config_file, validation_config_error_message
                    )
                )
                toolkit.send_usage_message(
                    data_context=context,
                    event="cli.validation_operator.run",
                    success=False,
                )
                sys.exit(1)

        else:
            if suite is None:
                cli_message(
                    """
Please use --suite argument to specify the name of the expectation suite.
Call `great_expectation suite list` command to list the expectation suites in your project.
"""
                )
                toolkit.send_usage_message(
                    data_context=context,
                    event="cli.validation_operator.run",
                    success=False,
                )
                sys.exit(0)

            suite = toolkit.load_expectation_suite(
                context, suite, "cli.validation_operator.run"
            )

            if name is None:
                cli_message(
                    """
Please use --name argument to specify the name of the validation operator.
Call `great_expectation validation-operator list` command to list the operators in your project.
"""
                )
                toolkit.send_usage_message(
                    data_context=context,
                    event="cli.validation_operator.run",
                    success=False,
                )
                sys.exit(1)
            else:
                if name not in context.list_validation_operator_names():
                    cli_message(
                        f"""
Could not find a validation operator {name}.
Call `great_expectation validation-operator list` command to list the operators in your project.
"""
                    )
                    toolkit.send_usage_message(
                        data_context=context,
                        event="cli.validation_operator.run",
                        success=False,
                    )
                    sys.exit(1)

            batch_kwargs = None

            cli_message(
                """
Let us help you specify the batch of data your want the validation operator to validate."""
            )

            try:
                data_source = toolkit.select_datasource(context)
            except ValueError as ve:
                cli_message(f"<red>{ve}</red>")
                toolkit.send_usage_message(
                    data_context=context,
                    event="cli.validation_operator.run",
                    success=False,
                )
                sys.exit(1)

            if not data_source:
                cli_message("<red>No datasources found in the context.</red>")
                toolkit.send_usage_message(
                    data_context=context,
                    event="cli.validation_operator.run",
                    success=False,
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
                    additional_batch_kwargs=None,
                )

            validation_config = {
                "validation_operator_name": name,
                "batches": [
                    {
                        "batch_kwargs": batch_kwargs,
                        "expectation_suite_names": [suite.expectation_suite_name],
                    }
                ],
            }

        try:
            validation_operator_name = validation_config["validation_operator_name"]
            batches_to_validate = []
            for entry in validation_config["batches"]:
                for expectation_suite_name in entry["expectation_suite_names"]:
                    batch = context.get_batch(
                        entry["batch_kwargs"], expectation_suite_name
                    )
                    batches_to_validate.append(batch)

            if run_name is None:
                run_name = datetime.datetime.now(datetime.timezone.utc).strftime(
                    "%Y%m%dT%H%M%S.%fZ"
                )

            run_id = RunIdentifier(run_name=run_name)

            if suite is None:
                results = context.run_validation_operator(
                    validation_operator_name,
                    assets_to_validate=batches_to_validate,
                    run_id=run_id,
                )
            else:
                if suite.evaluation_parameters is None:
                    results = context.run_validation_operator(
                        validation_operator_name,
                        assets_to_validate=batches_to_validate,
                        run_id=run_id,
                    )
                else:
                    results = context.run_validation_operator(
                        validation_operator_name,
                        assets_to_validate=batches_to_validate,
                        run_id=run_id,
                        evaluation_parameters=suite.evaluation_parameters,
                    )
        except (ge_exceptions.DataContextError, OSError, SQLAlchemyError) as e:
            cli_message(f"<red>{e}</red>")
            toolkit.send_usage_message(
                data_context=context, event="cli.validation_operator.run", success=False
            )
            sys.exit(1)

        if not results["success"]:
            cli_message("Validation failed!")
            toolkit.send_usage_message(
                data_context=context, event="cli.validation_operator.run", success=True
            )
            sys.exit(1)
        else:
            cli_message("Validation succeeded!")
            toolkit.send_usage_message(
                data_context=context, event="cli.validation_operator.run", success=True
            )
            sys.exit(0)
    except Exception as e:
        toolkit.send_usage_message(
            data_context=context, event="cli.validation_operator.run", success=False
        )
        raise e


def _validate_valdiation_config(valdiation_config):
    if "validation_operator_name" not in valdiation_config:
        return "validation_operator_name attribute is missing"
    if "batches" not in valdiation_config:
        return "batches attribute is missing"

    for batch in valdiation_config["batches"]:
        if "batch_kwargs" not in batch:
            return "Each batch must have a BatchKwargs dictionary in batch_kwargs attribute"
        if "expectation_suite_names" not in batch:
            return "Each batch must have a list of expectation suite names in expectation_suite_names attribute"

    return None
