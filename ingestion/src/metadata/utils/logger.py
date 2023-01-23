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
"""
Module centralising logger configs
"""

import logging
from enum import Enum
from types import DynamicClassAttribute
from typing import Optional, Union

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest

METADATA_LOGGER = "metadata"
BASE_LOGGING_FORMAT = (
    "[%(asctime)s] %(levelname)-8s {%(name)s:%(module)s:%(lineno)d} - %(message)s"
)
logging.basicConfig(format=BASE_LOGGING_FORMAT, datefmt="%Y-%m-%d %H:%M:%S")


class Loggers(Enum):
    """
    Enum for loggers
    """

    OMETA = "OMetaAPI"
    CLI = "Metadata"
    PROFILER = "Profiler"
    INGESTION = "Ingestion"
    UTILS = "Utils"
    GREAT_EXPECTATIONS = "GreatExpectations"
    PROFILER_INTERFACE = "ProfilerInterface"
    TEST_SUITE = "TestSuite"
    DATA_INSIGHT = "DataInsight"

    @DynamicClassAttribute
    def value(self):
        """Centralize the metadata logger under `metadata.NAME`"""
        # Disabling linting, false positive as it does not find _value_
        return METADATA_LOGGER + "." + self._value_  # pylint: disable=no-member


class ANSI(Enum):
    BRIGHT_RED = "\u001b[31;1m"
    BOLD = "\u001b[1m"
    BRIGHT_CYAN = "\u001b[36;1m"
    YELLOW = "\u001b[33;1m"
    GREEN = "\u001b[32;1m"
    ENDC = "\033[0m"
    BLUE = "\u001b[34;1m"
    MAGENTA = "\u001b[35;1m"


def ometa_logger():
    """
    Method to get the OMETA logger
    """

    return logging.getLogger(Loggers.OMETA.value)


def cli_logger():
    """
    Method to get the CLI logger
    """

    return logging.getLogger(Loggers.CLI.value)


def profiler_logger():
    """
    Method to get the PROFILER logger
    """

    return logging.getLogger(Loggers.PROFILER.value)


def test_suite_logger():
    """
    Method to get the TEST SUITE logger
    """

    return logging.getLogger(Loggers.TEST_SUITE.value)


def profiler_interface_registry_logger():
    """
    Method to get the PROFILER INTERFACE logger
    """

    return logging.getLogger(Loggers.PROFILER_INTERFACE.value)


def ingestion_logger():
    """
    Method to get the INGESTION logger
    """

    return logging.getLogger(Loggers.INGESTION.value)


def data_insight_logger():
    """
    Function to get the DATA INSIGHT logger
    """

    return logging.getLogger(Loggers.DATA_INSIGHT.value)


def utils_logger():
    """
    Method to get the UTILS logger
    """

    return logging.getLogger(Loggers.UTILS.value)


def great_expectations_logger():
    """
    Method to get the GREAT EXPECTATIONS logger
    """

    return logging.getLogger(Loggers.GREAT_EXPECTATIONS.value)


def set_loggers_level(level: Union[int, str] = logging.INFO):
    """
    Set all loggers levels
    :param level: logging level
    """
    logging.getLogger(METADATA_LOGGER).setLevel(level)


def get_add_lineage_log_str(add_lineage: AddLineageRequest) -> str:
    """
    Given a LineageRequest, parse its contents to return
    a string that we can log
    """

    # id and type will always be informed
    id_ = add_lineage.edge.fromEntity.id.__root__
    type_ = add_lineage.edge.fromEntity.type

    # name can be informed or not
    name_str = (
        f"name: {add_lineage.edge.fromEntity.name}, "
        if add_lineage.edge.fromEntity.name
        else ""
    )

    return f"{type_} [{name_str}id: {id_}]"


def log_ansi_encoded_string(
    color: Optional[ANSI] = None, bold: bool = False, message: str = ""
):
    utils_logger().info(
        f"{ANSI.BOLD.value if bold else ''}{color.value if color else ''}{message}{ANSI.ENDC.value}"
    )
