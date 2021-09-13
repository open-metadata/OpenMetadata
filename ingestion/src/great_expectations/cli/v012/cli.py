import logging

import click

from great_expectations import __version__ as ge_version
from great_expectations.cli.v012.checkpoint import checkpoint
from great_expectations.cli.v012.cli_logging import _set_up_logger
from great_expectations.cli.v012.datasource import datasource
from great_expectations.cli.v012.docs import docs
from great_expectations.cli.v012.init import init
from great_expectations.cli.v012.project import project
from great_expectations.cli.v012.store import store
from great_expectations.cli.v012.suite import suite
from great_expectations.cli.v012.validation_operator import validation_operator

try:
    from colorama import init as init_colorama

    init_colorama()
except ImportError:
    pass


# TODO: consider using a specified-order supporting class for help (but wasn't working with python 2)


@click.group()
@click.version_option(version=ge_version)
@click.option(
    "--verbose",
    "-v",
    is_flag=True,
    default=False,
    help="Set great_expectations to use verbose output.",
)
def cli(verbose):
    """
    Welcome to the great_expectations CLI!

    Most commands follow this format: great_expectations <NOUN> <VERB>

    The nouns are: datasource, docs, project, suite, validation-operator

    Most nouns accept the following verbs: new, list, edit

    In particular, the CLI supports the following special commands:

    - great_expectations init : create a new great_expectations project

    - great_expectations datasource profile : profile a datasource

    - great_expectations docs build : compile documentation from expectations"""
    logger = _set_up_logger()
    if verbose:
        # Note we are explicitly not using a logger in all CLI output to have
        # more control over console UI.
        logger.setLevel(logging.DEBUG)


cli.add_command(datasource)
cli.add_command(docs)
cli.add_command(init)
cli.add_command(project)
cli.add_command(suite)
cli.add_command(validation_operator)
cli.add_command(store)
cli.add_command(checkpoint)


def main():
    cli()


if __name__ == "__main__":
    main()
