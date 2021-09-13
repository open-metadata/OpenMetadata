import os
import sys

import click
import requests

from great_expectations.cli.v012 import toolkit
from great_expectations.cli.v012.cli_logging import logger
from great_expectations.cli.v012.util import cli_message, cli_message_list


@click.group()
def docs():
    """Data Docs operations"""
    pass


@docs.command(name="build")
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
@click.option(
    "--site-name",
    "-s",
    help="The site for which to generate documentation. See data_docs section in great_expectations.yml",
)
@click.option(
    "--view/--no-view",
    help="By default open in browser unless you specify the --no-view flag",
    default=True,
)
@click.option(
    "--assume-yes",
    "--yes",
    "-y",
    is_flag=True,
    help="By default request confirmation to build docs unless you specify -y/--yes/--assume-yes flag to skip dialog",
    default=False,
)
def docs_build(directory, site_name, view=True, assume_yes=False):
    """Build Data Docs for a project."""
    context = toolkit.load_data_context_with_error_handling(directory)
    build_docs(context, site_name=site_name, view=view, assume_yes=assume_yes)
    toolkit.send_usage_message(
        data_context=context, event="cli.docs.build", success=True
    )


@docs.command(name="list")
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
def docs_list(directory):
    """List known Data Docs Sites."""
    context = toolkit.load_data_context_with_error_handling(directory)

    docs_sites_url_dicts = context.get_docs_sites_urls()
    docs_sites_strings = [
        " - <cyan>{}</cyan>: {}".format(
            docs_site_dict["site_name"],
            docs_site_dict.get("site_url")
            or f"site configured but does not exist. Run the following command to build site: great_expectations "
            f'docs build --site-name {docs_site_dict["site_name"]}',
        )
        for docs_site_dict in docs_sites_url_dicts
    ]

    if len(docs_sites_strings) == 0:
        cli_message("No Data Docs sites found")
    else:
        list_intro_string = _build_intro_string(docs_sites_strings)
        cli_message_list(docs_sites_strings, list_intro_string)

    toolkit.send_usage_message(
        data_context=context, event="cli.docs.list", success=True
    )


@docs.command(name="clean")
@click.option("--directory", "-d", default=None, help="Clean data docs")
@click.option(
    "--site-name",
    "-s",
    help="The site that you want documentation cleaned for. See data_docs section in great_expectations.yml",
)
@click.option(
    "--all",
    "-a",
    is_flag=True,
    help="With this, all sites will get their data docs cleaned out. See data_docs section in great_expectations.yml",
)
def clean_data_docs(directory, site_name=None, all=None):
    """Delete data docs"""
    context = toolkit.load_data_context_with_error_handling(directory)
    failed = True
    if site_name is None and all is None:
        cli_message(
            "<red>{}</red>".format(
                "Please specify --all to remove all sites or specify a specific site using "
                "--site_name"
            )
        )
        sys.exit(1)
    context.clean_data_docs(site_name=site_name)
    failed = False
    if not failed and context is not None:
        toolkit.send_usage_message(
            data_context=context, event="cli.docs.clean", success=True
        )
        cli_message("<green>{}</green>".format("Cleaned data docs"))

    if failed and context is not None:
        toolkit.send_usage_message(
            data_context=context, event="cli.docs.clean", success=False
        )


def _build_intro_string(docs_sites_strings):
    doc_string_count = len(docs_sites_strings)
    if doc_string_count == 1:
        list_intro_string = "1 Data Docs site configured:"
    elif doc_string_count > 1:
        list_intro_string = f"{doc_string_count} Data Docs sites configured:"
    return list_intro_string


def build_docs(context, site_name=None, view=True, assume_yes=False):
    """Build documentation in a context"""
    logger.debug("Starting cli.datasource.build_docs")

    if site_name is not None:
        site_names = [site_name]
    else:
        site_names = None
    index_page_locator_infos = context.build_data_docs(
        site_names=site_names, dry_run=True
    )

    msg = "\nThe following Data Docs sites will be built:\n\n"
    for site_name, index_page_locator_info in index_page_locator_infos.items():
        msg += f" - <cyan>{site_name}:</cyan> "
        msg += f"{index_page_locator_info}\n"

    cli_message(msg)
    if not assume_yes:
        toolkit.confirm_proceed_or_exit()

    cli_message("\nBuilding Data Docs...\n")
    context.build_data_docs(site_names=site_names)

    cli_message("Done building Data Docs")

    if view:
        context.open_data_docs(site_name=site_name, only_if_exists=True)
