import datetime
import os
import subprocess
import sys
import warnings
from typing import Optional, Union

import click
from ruamel.yaml import YAML
from ruamel.yaml.compat import StringIO

from great_expectations import exceptions as ge_exceptions
from great_expectations.checkpoint import Checkpoint, LegacyCheckpoint
from great_expectations.cli.v012.cli_messages import SECTION_SEPARATOR
from great_expectations.cli.v012.datasource import get_batch_kwargs
from great_expectations.cli.v012.docs import build_docs
from great_expectations.cli.v012.upgrade_helpers import GE_UPGRADE_HELPER_VERSION_MAP
from great_expectations.cli.v012.util import cli_colorize_string, cli_message
from great_expectations.core.batch import Batch
from great_expectations.core.expectation_suite import ExpectationSuite
from great_expectations.core.id_dict import BatchKwargs
from great_expectations.core.usage_statistics.usage_statistics import (
    send_usage_message as send_usage_stats_message,
)
from great_expectations.data_asset import DataAsset
from great_expectations.data_context.data_context import DataContext
from great_expectations.data_context.types.base import CURRENT_GE_CONFIG_VERSION
from great_expectations.data_context.types.resource_identifiers import (
    ExpectationSuiteIdentifier,
    ValidationResultIdentifier,
)
from great_expectations.datasource import Datasource
from great_expectations.profile import BasicSuiteBuilderProfiler

EXIT_UPGRADE_CONTINUATION_MESSAGE = (
    "\nOk, exiting now. To upgrade at a later time, use the following command: "
    "<cyan>great_expectations project upgrade</cyan>\n\nTo learn more about the upgrade "
    "process, visit "
    "<cyan>https://docs.greatexpectations.io/en/latest/how_to_guides/migrating_versions.html"
    "</cyan>.\n"
)


class MyYAML(YAML):
    # copied from https://yaml.readthedocs.io/en/latest/example.html#output-of-dump-as-a-string
    def dump(self, data, stream=None, **kw):
        inefficient = False
        if stream is None:
            inefficient = True
            stream = StringIO()
        YAML.dump(self, data, stream, **kw)
        if inefficient:
            return stream.getvalue()


yaml = MyYAML()  # or typ='safe'/'unsafe' etc

yaml.indent(mapping=2, sequence=4, offset=2)
yaml.default_flow_style = False


def create_expectation_suite(
    context,
    datasource_name=None,
    batch_kwargs_generator_name=None,
    generator_asset=None,
    batch_kwargs=None,
    expectation_suite_name=None,
    additional_batch_kwargs=None,
    empty_suite=False,
    show_intro_message=False,
    flag_build_docs=True,
    open_docs=False,
    profiler_configuration="demo",
    data_asset_name=None,
):
    """
    Create a new expectation suite.

    WARNING: the flow and name of this method and its interaction with _profile_to_create_a_suite
    require a serious revisiting.
    :return: a tuple: (success, suite name, profiling_results)
    """
    if generator_asset:
        warnings.warn(
            "The 'generator_asset' argument will be deprecated and renamed to 'data_asset_name'. "
            "Please update code accordingly.",
            DeprecationWarning,
        )
        data_asset_name = generator_asset

    if show_intro_message and not empty_suite:
        cli_message(
            "\n<cyan>========== Create sample Expectations ==========</cyan>\n\n"
        )

    data_source = select_datasource(context, datasource_name=datasource_name)

    if data_source is None:
        # select_datasource takes care of displaying an error message, so all is left here is to exit.
        sys.exit(1)

    datasource_name = data_source.name

    if expectation_suite_name in context.list_expectation_suite_names():
        tell_user_suite_exists(expectation_suite_name)
        sys.exit(1)

    if (
        batch_kwargs_generator_name is None
        or data_asset_name is None
        or batch_kwargs is None
    ):
        (
            datasource_name,
            batch_kwargs_generator_name,
            data_asset_name,
            batch_kwargs,
        ) = get_batch_kwargs(
            context,
            datasource_name=datasource_name,
            batch_kwargs_generator_name=batch_kwargs_generator_name,
            data_asset_name=data_asset_name,
            additional_batch_kwargs=additional_batch_kwargs,
        )
        # In this case, we have "consumed" the additional_batch_kwargs
        additional_batch_kwargs = {}

    if expectation_suite_name is None:
        default_expectation_suite_name = _get_default_expectation_suite_name(
            batch_kwargs, data_asset_name
        )
        while True:
            expectation_suite_name = click.prompt(
                "\nName the new Expectation Suite",
                default=default_expectation_suite_name,
            )
            if expectation_suite_name in context.list_expectation_suite_names():
                tell_user_suite_exists(expectation_suite_name)
            else:
                break

    if empty_suite:
        create_empty_suite(context, expectation_suite_name, batch_kwargs)
        return True, expectation_suite_name, None

    profiling_results = _profile_to_create_a_suite(
        additional_batch_kwargs,
        batch_kwargs,
        batch_kwargs_generator_name,
        context,
        datasource_name,
        expectation_suite_name,
        data_asset_name,
        profiler_configuration,
    )

    if flag_build_docs:
        build_docs(context, view=False)
        if open_docs:
            attempt_to_open_validation_results_in_data_docs(context, profiling_results)

    return True, expectation_suite_name, profiling_results


def _profile_to_create_a_suite(
    additional_batch_kwargs,
    batch_kwargs,
    batch_kwargs_generator_name,
    context,
    datasource_name,
    expectation_suite_name,
    data_asset_name,
    profiler_configuration,
):

    cli_message(
        """
Great Expectations will choose a couple of columns and generate expectations about them
to demonstrate some examples of assertions you can make about your data.

Great Expectations will store these expectations in a new Expectation Suite '{:s}' here:

  {:s}
""".format(
            expectation_suite_name,
            context.stores[
                context.expectations_store_name
            ].store_backend.get_url_for_key(
                ExpectationSuiteIdentifier(
                    expectation_suite_name=expectation_suite_name
                ).to_tuple()
            ),
        )
    )

    confirm_proceed_or_exit()

    # TODO this may not apply
    cli_message("\nGenerating example Expectation Suite...")
    run_id = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    profiling_results = context.profile_data_asset(
        datasource_name,
        batch_kwargs_generator_name=batch_kwargs_generator_name,
        data_asset_name=data_asset_name,
        batch_kwargs=batch_kwargs,
        profiler=BasicSuiteBuilderProfiler,
        profiler_configuration=profiler_configuration,
        expectation_suite_name=expectation_suite_name,
        run_id=run_id,
        additional_batch_kwargs=additional_batch_kwargs,
    )
    if not profiling_results["success"]:
        _raise_profiling_errors(profiling_results)

    cli_message("\nDone generating example Expectation Suite")
    return profiling_results


def _raise_profiling_errors(profiling_results):
    if (
        profiling_results["error"]["code"]
        == DataContext.PROFILING_ERROR_CODE_SPECIFIED_DATA_ASSETS_NOT_FOUND
    ):
        raise ge_exceptions.DataContextError(
            """Some of the data assets you specified were not found: {:s}
            """.format(
                ",".join(profiling_results["error"]["not_found_data_assets"])
            )
        )
    raise ge_exceptions.DataContextError(
        "Unknown profiling error code: " + profiling_results["error"]["code"]
    )


def attempt_to_open_validation_results_in_data_docs(context, profiling_results):
    try:
        # TODO this is really brittle and not covered in tests
        validation_result = profiling_results["results"][0][1]
        validation_result_identifier = ValidationResultIdentifier.from_object(
            validation_result
        )

        context.open_data_docs(resource_identifier=validation_result_identifier)
    except (KeyError, IndexError):
        context.open_data_docs()


def _get_default_expectation_suite_name(batch_kwargs, data_asset_name):
    if data_asset_name:
        suite_name = f"{data_asset_name}.warning"
    elif "query" in batch_kwargs:
        suite_name = "query.warning"
    elif "path" in batch_kwargs:
        try:
            # Try guessing a filename
            filename = os.path.split(os.path.normpath(batch_kwargs["path"]))[1]
            # Take all but the last part after the period
            filename = ".".join(filename.split(".")[:-1])
            suite_name = str(filename) + ".warning"
        except (OSError, IndexError):
            suite_name = "warning"
    else:
        suite_name = "warning"
    return suite_name


def tell_user_suite_exists(suite_name: str) -> None:
    cli_message(
        f"""<red>An expectation suite named `{suite_name}` already exists.</red>
  - If you intend to edit the suite please use `great_expectations suite edit {suite_name}`."""
    )


def create_empty_suite(
    context: DataContext, expectation_suite_name: str, batch_kwargs
) -> None:
    cli_message(
        """
Great Expectations will create a new Expectation Suite '{:s}' and store it here:

  {:s}
""".format(
            expectation_suite_name,
            context.stores[
                context.expectations_store_name
            ].store_backend.get_url_for_key(
                ExpectationSuiteIdentifier(
                    expectation_suite_name=expectation_suite_name
                ).to_tuple()
            ),
        )
    )
    suite = context.create_expectation_suite(expectation_suite_name)
    suite.add_citation(comment="New suite added via CLI", batch_kwargs=batch_kwargs)
    context.save_expectation_suite(suite, expectation_suite_name)


def launch_jupyter_notebook(notebook_path: str) -> None:
    jupyter_command_override = os.getenv("GE_JUPYTER_CMD", None)
    if jupyter_command_override:
        subprocess.call(f"{jupyter_command_override} {notebook_path}", shell=True)
    else:
        subprocess.call(["jupyter", "notebook", notebook_path])


def load_batch(
    context: DataContext,
    suite: Union[str, ExpectationSuite],
    batch_kwargs: Union[dict, BatchKwargs],
) -> Union[Batch, DataAsset]:
    batch: Union[Batch, DataAsset] = context.get_batch(batch_kwargs, suite)
    assert isinstance(batch, DataAsset) or isinstance(
        batch, Batch
    ), "Batch failed to load. Please check your batch_kwargs"
    return batch


def load_expectation_suite(
    # TODO consolidate all the myriad CLI tests into this
    context: DataContext,
    suite_name: str,
    usage_event: str,
) -> ExpectationSuite:
    """
    Load an expectation suite from a given context.

    Handles a suite name with or without `.json`
    :param usage_event:
    """
    if suite_name.endswith(".json"):
        suite_name = suite_name[:-5]
    try:
        suite = context.get_expectation_suite(suite_name)
        return suite
    except ge_exceptions.DataContextError as e:
        exit_with_failure_message_and_stats(
            context,
            usage_event,
            f"<red>Could not find a suite named `{suite_name}`.</red> Please check "
            "the name by running `great_expectations suite list` and try again.",
        )


def exit_with_failure_message_and_stats(
    context: DataContext, usage_event: str, message: str
) -> None:
    cli_message(message)
    send_usage_message(context, event=usage_event, success=False)
    sys.exit(1)


def load_checkpoint(
    context: DataContext,
    checkpoint_name: str,
    usage_event: str,
) -> Union[Checkpoint, LegacyCheckpoint]:
    """Load a checkpoint or raise helpful errors."""
    try:
        checkpoint: Union[Checkpoint, LegacyCheckpoint] = context.get_checkpoint(
            name=checkpoint_name
        )
        return checkpoint
    except (
        ge_exceptions.CheckpointNotFoundError,
        ge_exceptions.InvalidCheckpointConfigError,
    ):
        exit_with_failure_message_and_stats(
            context,
            usage_event,
            f"""\
<red>Could not find checkpoint `{checkpoint_name}`.</red> Try running:
  - `<green>great_expectations checkpoint list</green>` to verify your checkpoint exists
  - `<green>great_expectations checkpoint new</green>` to configure a new checkpoint""",
        )
    except ge_exceptions.CheckpointError as e:
        exit_with_failure_message_and_stats(context, usage_event, f"<red>{e}</red>")


def select_datasource(context: DataContext, datasource_name: str = None) -> Datasource:
    """Select a datasource interactively."""
    # TODO consolidate all the myriad CLI tests into this
    data_source = None

    if datasource_name is None:
        data_sources = sorted(context.list_datasources(), key=lambda x: x["name"])
        if len(data_sources) == 0:
            cli_message(
                "<red>No datasources found in the context. To add a datasource, run `great_expectations datasource new`</red>"
            )
        elif len(data_sources) == 1:
            datasource_name = data_sources[0]["name"]
        else:
            choices = "\n".join(
                [
                    "    {}. {}".format(i, data_source["name"])
                    for i, data_source in enumerate(data_sources, 1)
                ]
            )
            option_selection = click.prompt(
                "Select a datasource" + "\n" + choices + "\n",
                type=click.Choice(
                    [str(i) for i, data_source in enumerate(data_sources, 1)]
                ),
                show_choices=False,
            )
            datasource_name = data_sources[int(option_selection) - 1]["name"]

    if datasource_name is not None:
        data_source = context.get_datasource(datasource_name)

    return data_source


def load_data_context_with_error_handling(
    directory: str, from_cli_upgrade_command: bool = False
) -> DataContext:
    """Return a DataContext with good error handling and exit codes."""
    try:
        context: DataContext = DataContext(context_root_dir=directory)
        ge_config_version: int = context.get_config().config_version
        if (
            from_cli_upgrade_command
            and int(ge_config_version) < CURRENT_GE_CONFIG_VERSION
        ):
            directory = directory or context.root_directory
            (
                increment_version,
                exception_occurred,
            ) = upgrade_project_one_version_increment(
                context_root_dir=directory,
                ge_config_version=ge_config_version,
                continuation_message=EXIT_UPGRADE_CONTINUATION_MESSAGE,
                from_cli_upgrade_command=from_cli_upgrade_command,
            )
            if not exception_occurred and increment_version:
                context = DataContext(context_root_dir=directory)
        return context
    except ge_exceptions.UnsupportedConfigVersionError as err:
        directory = directory or DataContext.find_context_root_dir()
        ge_config_version = DataContext.get_ge_config_version(
            context_root_dir=directory
        )
        upgrade_helper_class = (
            GE_UPGRADE_HELPER_VERSION_MAP.get(int(ge_config_version))
            if ge_config_version
            else None
        )
        if upgrade_helper_class and ge_config_version < CURRENT_GE_CONFIG_VERSION:
            upgrade_project(
                context_root_dir=directory,
                ge_config_version=ge_config_version,
                from_cli_upgrade_command=from_cli_upgrade_command,
            )
        else:
            cli_message(f"<red>{err.message}</red>")
            sys.exit(1)
    except (
        ge_exceptions.ConfigNotFoundError,
        ge_exceptions.InvalidConfigError,
    ) as err:
        cli_message(f"<red>{err.message}</red>")
        sys.exit(1)
    except ge_exceptions.PluginModuleNotFoundError as err:
        cli_message(err.cli.v012_colored_message)
        sys.exit(1)
    except ge_exceptions.PluginClassNotFoundError as err:
        cli_message(err.cli.v012_colored_message)
        sys.exit(1)
    except ge_exceptions.InvalidConfigurationYamlError as err:
        cli_message(f"<red>{str(err)}</red>")
        sys.exit(1)


def upgrade_project(
    context_root_dir, ge_config_version, from_cli_upgrade_command=False
):
    if from_cli_upgrade_command:
        message = (
            f"<red>\nYour project appears to have an out-of-date config version ({ge_config_version}) - "
            f"the version "
            f"number must be at least {CURRENT_GE_CONFIG_VERSION}.</red>"
        )
    else:
        message = (
            f"<red>\nYour project appears to have an out-of-date config version ({ge_config_version}) - "
            f"the version "
            f"number must be at least {CURRENT_GE_CONFIG_VERSION}.\nIn order to proceed, "
            f"your project must be upgraded.</red>"
        )

    cli_message(message)
    upgrade_prompt = (
        "\nWould you like to run the Upgrade Helper to bring your project up-to-date?"
    )
    confirm_proceed_or_exit(
        confirm_prompt=upgrade_prompt,
        continuation_message=EXIT_UPGRADE_CONTINUATION_MESSAGE,
    )
    cli_message(SECTION_SEPARATOR)

    # use loop in case multiple upgrades need to take place
    while ge_config_version < CURRENT_GE_CONFIG_VERSION:
        increment_version, exception_occurred = upgrade_project_one_version_increment(
            context_root_dir=context_root_dir,
            ge_config_version=ge_config_version,
            continuation_message=EXIT_UPGRADE_CONTINUATION_MESSAGE,
            from_cli_upgrade_command=from_cli_upgrade_command,
        )
        if exception_occurred or not increment_version:
            break
        ge_config_version += 1

    cli_message(SECTION_SEPARATOR)
    upgrade_success_message = "<green>Upgrade complete. Exiting...</green>\n"
    upgrade_incomplete_message = f"""\
<red>The Upgrade Helper was unable to perform a complete project upgrade. Next steps:</red>

    - Please perform any manual steps outlined in the Upgrade Overview and/or Upgrade Report above
    - When complete, increment the config_version key in your <cyan>great_expectations.yml</cyan> to <cyan>{
    ge_config_version + 1}</cyan>\n
To learn more about the upgrade process, visit \
<cyan>https://docs.greatexpectations.io/en/latest/how_to_guides/migrating_versions.html</cyan>
"""

    if ge_config_version < CURRENT_GE_CONFIG_VERSION:
        cli_message(upgrade_incomplete_message)
    else:
        cli_message(upgrade_success_message)
    sys.exit(0)


def upgrade_project_one_version_increment(
    context_root_dir: str,
    ge_config_version: float,
    continuation_message: str,
    from_cli_upgrade_command: bool = False,
) -> [bool, bool]:  # Returns increment_version, exception_occurred
    upgrade_helper_class = GE_UPGRADE_HELPER_VERSION_MAP.get(int(ge_config_version))
    if not upgrade_helper_class:
        return False, False
    target_ge_config_version = int(ge_config_version) + 1
    # set version temporarily to CURRENT_GE_CONFIG_VERSION to get functional DataContext
    DataContext.set_ge_config_version(
        config_version=CURRENT_GE_CONFIG_VERSION,
        context_root_dir=context_root_dir,
    )
    upgrade_helper = upgrade_helper_class(context_root_dir=context_root_dir)
    upgrade_overview, confirmation_required = upgrade_helper.get_upgrade_overview()

    if confirmation_required or from_cli_upgrade_command:
        upgrade_confirmed = confirm_proceed_or_exit(
            confirm_prompt=upgrade_overview,
            continuation_message=continuation_message,
            exit_on_no=False,
        )
    else:
        upgrade_confirmed = True

    if upgrade_confirmed:
        cli_message("\nUpgrading project...")
        cli_message(SECTION_SEPARATOR)
        # run upgrade and get report of what was done, if version number should be incremented
        (
            upgrade_report,
            increment_version,
            exception_occurred,
        ) = upgrade_helper.upgrade_project()
        # display report to user
        cli_message(upgrade_report)
        if exception_occurred:
            # restore version number to current number
            DataContext.set_ge_config_version(
                ge_config_version, context_root_dir, validate_config_version=False
            )
            # display report to user
            return False, True
        # set config version to target version
        if increment_version:
            DataContext.set_ge_config_version(
                target_ge_config_version,
                context_root_dir,
                validate_config_version=False,
            )
            return True, False
        # restore version number to current number
        DataContext.set_ge_config_version(
            ge_config_version, context_root_dir, validate_config_version=False
        )
        return False, False

    # restore version number to current number
    DataContext.set_ge_config_version(
        ge_config_version, context_root_dir, validate_config_version=False
    )
    cli_message(continuation_message)
    sys.exit(0)


def confirm_proceed_or_exit(
    confirm_prompt: str = "Would you like to proceed?",
    continuation_message: str = "Ok, exiting now. You can always read more at https://docs.greatexpectations.io/ !",
    exit_on_no: bool = True,
    exit_code: int = 0,
) -> Optional[bool]:
    """
    Every CLI command that starts a potentially lengthy (>1 sec) computation
    or modifies some resources (e.g., edits the config file, adds objects
    to the stores) must follow this pattern:
    1. Explain which resources will be created/modified/deleted
    2. Use this method to ask for user's confirmation

    The goal of this standardization is for the users to expect consistency -
    if you saw one command, you know what to expect from all others.

    If the user does not confirm, the program should exit. The purpose of the exit_on_no parameter is to provide
    the option to perform cleanup actions before exiting outside of the function.
    """
    confirm_prompt_colorized = cli_colorize_string(confirm_prompt)
    continuation_message_colorized = cli_colorize_string(continuation_message)
    if not click.confirm(confirm_prompt_colorized, default=True):
        if exit_on_no:
            cli_message(continuation_message_colorized)
            sys.exit(exit_code)
        else:
            return False
    return True


def send_usage_message(
    data_context: DataContext,
    event: str,
    event_payload: Optional[dict] = None,
    success: bool = False,
):
    if event_payload is None:
        event_payload = {}
    event_payload.update({"api_version": "v2"})
    send_usage_stats_message(
        data_context=data_context,
        event=event,
        event_payload=event_payload,
        success=success,
    )
