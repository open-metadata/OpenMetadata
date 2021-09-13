from typing import Dict, List, Optional

from great_expectations import DataContext
from great_expectations.cli import toolkit
from great_expectations.cli.cli_logging import logger
from great_expectations.cli.pretty_printing import cli_message


def build_docs(
    context: DataContext,
    usage_stats_event: str,
    site_names: Optional[List[str]] = None,
    view: Optional[bool] = True,
    assume_yes: Optional[bool] = False,
):
    """Build documentation in a context"""
    logger.debug("Starting cli.datasource.build_docs")

    index_page_locator_infos: Dict[str, str] = context.build_data_docs(
        site_names=site_names, dry_run=True
    )

    msg: str = "\nThe following Data Docs sites will be built:\n\n"
    for site_name, index_page_locator_info in index_page_locator_infos.items():
        msg += f" - <cyan>{site_name}:</cyan> "
        msg += f"{index_page_locator_info}\n"

    cli_message(msg)
    if not assume_yes:
        toolkit.confirm_proceed_or_exit(
            data_context=context, usage_stats_event=usage_stats_event
        )

    cli_message("\nBuilding Data Docs...\n")
    context.build_data_docs(site_names=site_names)

    cli_message("Done building Data Docs")

    if view and site_names:
        for site_to_open in site_names:
            context.open_data_docs(site_name=site_to_open, only_if_exists=True)
