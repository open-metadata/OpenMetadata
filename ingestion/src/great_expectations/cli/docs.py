import click

from great_expectations import DataContext
from great_expectations.cli import toolkit
from great_expectations.cli.build_docs import build_docs
from great_expectations.cli.pretty_printing import cli_message, cli_message_list
from great_expectations.exceptions import DataContextError


@click.group()
@click.pass_context
def docs(ctx):
    """Data Docs operations"""
    directory: str = toolkit.parse_cli_config_file_location(
        config_file_location=ctx.obj.config_file_location
    ).get("directory")
    context: DataContext = toolkit.load_data_context_with_error_handling(
        directory=directory,
        from_cli_upgrade_command=False,
    )
    # TODO consider moving this all the way up in to the CLIState constructor
    ctx.obj.data_context = context

    usage_stats_prefix = f"cli.docs.{ctx.invoked_subcommand}"
    toolkit.send_usage_message(
        data_context=context,
        event=f"{usage_stats_prefix}.begin",
        success=True,
    )
    ctx.obj.usage_event_end = f"{usage_stats_prefix}.end"


@docs.command(name="build")
@click.option(
    "--site-name",
    "-sn",
    help="The site for which to generate documentation. If not present all sites will be built. See data_docs section in great_expectations.yml",
)
@click.option(
    "--no-view",
    "-nv",
    "no_view",
    is_flag=True,
    help="By default open in browser unless you specify the --no-view flag",
    default=False,
)
@click.pass_context
def docs_build(ctx, site_name=None, no_view=False):
    """Build Data Docs for a project."""
    context: DataContext = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end

    if site_name is not None and site_name not in context.get_site_names():
        toolkit.exit_with_failure_message_and_stats(
            data_context=context,
            usage_event=usage_event_end,
            message=f"<red>The specified site name `{site_name}` does not exist in this project.</red>",
        )
    if site_name is None:
        sites_to_build = context.get_site_names()
    else:
        sites_to_build = [site_name]

    build_docs(
        context,
        usage_stats_event=usage_event_end,
        site_names=sites_to_build,
        view=not no_view,
        assume_yes=ctx.obj.assume_yes,
    )
    toolkit.send_usage_message(
        data_context=context, event=usage_event_end, success=True
    )


@docs.command(name="list")
@click.pass_context
def docs_list(ctx):
    """List known Data Docs sites."""
    context = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end
    docs_sites_url_dicts = context.get_docs_sites_urls()

    try:
        if len(docs_sites_url_dicts) == 0:
            cli_message("No Data Docs sites found")
        else:
            docs_sites_strings = [
                " - <cyan>{}</cyan>: {}".format(
                    docs_site_dict["site_name"],
                    docs_site_dict.get("site_url")
                    or f"site configured but does not exist. Run the following command to build site: great_expectations "
                    f'docs build --site-name {docs_site_dict["site_name"]}',
                )
                for docs_site_dict in docs_sites_url_dicts
            ]
            list_intro_string = _build_intro_string(docs_sites_strings)
            cli_message_list(docs_sites_strings, list_intro_string)

        toolkit.send_usage_message(
            data_context=context, event=usage_event_end, success=True
        )

    except Exception as e:
        toolkit.exit_with_failure_message_and_stats(
            context=context,
            usage_event=usage_event_end,
            message=f"<red>{e}</red>",
        )
        return


@docs.command(name="clean")
@click.option(
    "--site-name",
    "-s",
    help="The site that you want documentation cleaned for. See data_docs section in great_expectations.yml",
)
@click.option(
    "--all",
    "-a",
    "all_sites",
    is_flag=True,
    help="With this, all sites will get their data docs cleaned out. See data_docs section in great_expectations.yml",
)
@click.pass_context
def docs_clean(ctx, site_name=None, all_sites=False):
    """
    Remove all files from a Data Docs site.

    This is a useful first step if you wish to completely re-build a site from scratch.
    """
    context = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end

    if (site_name is None and all_sites is False) or (site_name and all_sites):
        toolkit.exit_with_failure_message_and_stats(
            data_context=context,
            usage_event=usage_event_end,
            message="<red>Please specify either --all to clean all sites or a specific site using --site-name</red>",
        )
    try:
        # if site_name is None, context.clean_data_docs(site_name=site_name)
        # will clean all sites.
        context.clean_data_docs(site_name=site_name)
        toolkit.send_usage_message(
            data_context=context, event=usage_event_end, success=True
        )
        cli_message("<green>{}</green>".format("Cleaned data docs"))
    except DataContextError as de:
        toolkit.exit_with_failure_message_and_stats(
            data_context=context,
            usage_event=usage_event_end,
            message=f"<red>{de}</red>",
        )


def _build_intro_string(docs_sites_strings):
    doc_string_count = len(docs_sites_strings)
    if doc_string_count == 1:
        list_intro_string = "1 Data Docs site configured:"
    elif doc_string_count > 1:
        list_intro_string = f"{doc_string_count} Data Docs sites configured:"
    return list_intro_string
