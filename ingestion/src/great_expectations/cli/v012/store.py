import click

from great_expectations.cli.v012 import toolkit
from great_expectations.cli.v012.util import cli_message, cli_message_dict


@click.group()
def store():
    """Store operations"""
    pass


@store.command(name="list")
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
def store_list(directory):
    """List known Stores."""
    context = toolkit.load_data_context_with_error_handling(directory)

    try:
        stores = context.list_stores()

        if len(stores) == 0:
            cli_message("No Stores found")
            toolkit.send_usage_message(
                data_context=context, event="cli.store.list", success=True
            )
            return
        elif len(stores) == 1:
            list_intro_string = "1 Store found:"
        else:
            list_intro_string = f"{len(stores)} Stores found:"

        cli_message(list_intro_string)

        for store in stores:
            cli_message("")
            cli_message_dict(store)

        toolkit.send_usage_message(
            data_context=context, event="cli.store.list", success=True
        )
    except Exception as e:
        toolkit.send_usage_message(
            data_context=context, event="cli.store.list", success=False
        )
        raise e
