import sys

import click

from great_expectations import DataContext
from great_expectations import exceptions as ge_exceptions
from great_expectations.cli import toolkit
from great_expectations.cli.cli_messages import SECTION_SEPARATOR
from great_expectations.cli.pretty_printing import cli_message
from great_expectations.cli.toolkit import load_data_context_with_error_handling
from great_expectations.data_context.types.base import CURRENT_GE_CONFIG_VERSION


@click.group()
def project():
    """Project operations"""
    pass


@project.command(name="check-config")
@click.pass_context
def project_check_config(ctx):
    """Check a config for validity and help with migrations."""
    cli_message("Checking your config files for validity...\n")
    directory = toolkit.parse_cli_config_file_location(
        config_file_location=ctx.obj.config_file_location
    ).get("directory")
    is_config_ok, error_message, context = do_config_check(directory)
    if context:
        toolkit.send_usage_message(
            data_context=context, event="cli.project.check_config", success=True
        )
    if not is_config_ok:
        cli_message("Unfortunately, your config appears to be invalid:\n")
        cli_message(f"<red>{error_message}</red>")
        sys.exit(1)

    cli_message("<green>Your config file appears valid!</green>")


@project.command(name="upgrade")
@click.pass_context
def project_upgrade(ctx):
    """Upgrade a project after installing the next Great Expectations major version."""
    cli_message("\nChecking project...")
    cli_message(SECTION_SEPARATOR)
    directory = toolkit.parse_cli_config_file_location(
        config_file_location=ctx.obj.config_file_location
    ).get("directory")
    if load_data_context_with_error_handling(
        directory=directory, from_cli_upgrade_command=True
    ):
        up_to_date_message = (
            "Your project is up-to-date - no further upgrade is necessary.\n"
        )
        cli_message(f"<green>{up_to_date_message}</green>")
        sys.exit(0)


def do_config_check(target_directory):
    try:
        context: DataContext = DataContext(context_root_dir=target_directory)
        ge_config_version: int = context.get_config().config_version
        if int(ge_config_version) < CURRENT_GE_CONFIG_VERSION:
            upgrade_message: str = f"""The config_version of your great_expectations.yml -- {float(ge_config_version)} -- is outdated.
Please consult the 0.13.x migration guide ttps://docs.greatexpectations.io/en/latest/guides/how_to_guides/migrating_versions.html and
upgrade your Great Expectations configuration to version {float(CURRENT_GE_CONFIG_VERSION)} in order to take advantage of the latest capabilities.
            """
            return (
                False,
                upgrade_message,
                None,
            )
        return True, None, context
    except (
        ge_exceptions.InvalidConfigurationYamlError,
        ge_exceptions.InvalidTopLevelConfigKeyError,
        ge_exceptions.MissingTopLevelConfigKeyError,
        ge_exceptions.InvalidConfigValueTypeError,
        ge_exceptions.UnsupportedConfigVersionError,
        ge_exceptions.DataContextError,
        ge_exceptions.PluginClassNotFoundError,
        ge_exceptions.PluginModuleNotFoundError,
        ge_exceptions.GreatExpectationsError,
    ) as err:
        return False, err.message, None
