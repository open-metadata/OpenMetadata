#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import logging
import pathlib
import sys

import click
from openmetadata.common.config import load_config_file
from openmetadata.profiler.profiler_metadata import ProfileResult
from openmetadata.profiler.profiler_runner import ProfilerRunner
from pydantic import ValidationError

logger = logging.getLogger(__name__)

# Configure logger.
BASE_LOGGING_FORMAT = (
    "[%(asctime)s] %(levelname)-8s {%(name)s:%(lineno)d} - %(message)s"
)
logging.basicConfig(format=BASE_LOGGING_FORMAT)


@click.group()
def check() -> None:
    pass


@click.group()
@click.option("--debug/--no-debug", default=False)
def openmetadata(debug: bool) -> None:
    if debug:
        logging.getLogger().setLevel(logging.INFO)
        logging.getLogger("openmetadata").setLevel(logging.DEBUG)
    else:
        logging.getLogger().setLevel(logging.WARNING)
        logging.getLogger("openmetadata").setLevel(logging.INFO)


@openmetadata.command()
@click.option(
    "-c",
    "--config",
    type=click.Path(exists=True, dir_okay=False),
    help="Profiler config",
    required=True,
)
def profiler(config: str) -> None:
    """Main command for running data openmetadata and tests"""
    try:
        config_file = pathlib.Path(config)
        profiler_config = load_config_file(config_file)
        try:
            logger.info(f"Using config: {profiler_config}")
            profiler_runner = ProfilerRunner.create(profiler_config)
        except ValidationError as e:
            click.echo(e, err=True)
            sys.exit(1)

        logger.info(f"Running Profiler for  {profiler_runner.table_name} ...")
        profile_result: ProfileResult = profiler_runner.execute()
        logger.info(f"Profiler Results")
        logger.info(f"{profile_result.json()}")

    except Exception as e:
        logger.exception(f"Scan failed: {str(e)}")
        logger.info(f"Exiting with code 1")
        sys.exit(1)


openmetadata.add_command(check)
