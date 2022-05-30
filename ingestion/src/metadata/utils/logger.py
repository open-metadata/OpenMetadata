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
from typing import Union

BASE_LOGGING_FORMAT = (
    "[%(asctime)s] %(levelname)-8s {%(name)s:%(module)s:%(lineno)d} - %(message)s"
)
logging.basicConfig(format=BASE_LOGGING_FORMAT, datefmt="%Y-%m-%d %H:%M:%S")


class Loggers(Enum):
    OMETA = "OMetaAPI"
    CLI = "Metadata"
    PROFILER = "Profiler"
    INGESTION = "Ingestion"
    UTILS = "Utils"
    GREAT_EXPECTATIONS = "GreatExpectations"


def ometa_logger():
    return logging.getLogger(Loggers.OMETA.value)


def cli_logger():
    return logging.getLogger(Loggers.CLI.value)


def profiler_logger():
    return logging.getLogger(Loggers.PROFILER.value)


def ingestion_logger():
    return logging.getLogger(Loggers.INGESTION.value)


def utils_logger():
    return logging.getLogger(Loggers.UTILS.value)


def great_expectations_logger():
    return logging.getLogger(Loggers.GREAT_EXPECTATIONS.value)


def set_loggers_level(level: Union[int, str] = logging.INFO):
    """
    Set all loggers levels
    :param level: logging level
    """
    ometa_logger().setLevel(level)
    cli_logger().setLevel(level)
    profiler_logger().setLevel(level)
    ingestion_logger().setLevel(level)
    utils_logger().setLevel(level)
    great_expectations_logger().setLevel(level)
