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
from copy import deepcopy
from enum import Enum
from functools import singledispatch
from types import DynamicClassAttribute
from typing import Dict, Optional, Union

from metadata.data_quality.api.models import (
    TableAndTests,
    TestCaseResultResponse,
    TestCaseResults,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.type.queryParserData import QueryParserData
from metadata.generated.schema.type.tableQuery import TableQueries
from metadata.ingestion.api.models import Entity
from metadata.ingestion.models.delete_entity import DeleteEntity
from metadata.ingestion.models.life_cycle import OMetaLifeCycleData
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.patch_request import PatchRequest
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus

METADATA_LOGGER = "metadata"
BASE_LOGGING_FORMAT = (
    "[%(asctime)s] %(levelname)-8s {%(name)s:%(module)s:%(lineno)d} - %(message)s"
)
logging.basicConfig(format=BASE_LOGGING_FORMAT, datefmt="%Y-%m-%d %H:%M:%S")

REDACTED_KEYS = {"serviceConnection", "securityConfig"}


class Loggers(Enum):
    """
    Enum for loggers
    """

    OMETA = "OMetaAPI"
    CLI = "Metadata"
    PROFILER = "Profiler"
    SAMPLER = "Sampler"
    PII = "PII"
    INGESTION = "Ingestion"
    UTILS = "Utils"
    GREAT_EXPECTATIONS = "GreatExpectations"
    PROFILER_INTERFACE = "ProfilerInterface"
    TEST_SUITE = "TestSuite"
    QUERY_RUNNER = "QueryRunner"
    APP = "App"

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


def sampler_logger():
    """
    Method to get the SAMPLER logger
    """

    return logging.getLogger(Loggers.SAMPLER.value)


def pii_logger():
    """
    Method to get the PROFILER logger
    """

    return logging.getLogger(Loggers.PII.value)


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


def app_logger():
    """
    Method to get the APP logger
    """

    return logging.getLogger(Loggers.APP.value)


def query_runner_logger():
    """
    Method to get the QUERY_RUNNER logger
    """

    return logging.getLogger(Loggers.QUERY_RUNNER.value)


def set_loggers_level(level: Union[int, str] = logging.INFO):
    """
    Set all loggers levels
    :param level: logging level
    """
    logging.getLogger(METADATA_LOGGER).setLevel(level)


def log_ansi_encoded_string(
    color: Optional[ANSI] = None,
    bold: bool = False,
    message: str = "",
    level=logging.INFO,
):
    utils_logger().log(
        level=level,
        msg=f"{ANSI.BOLD.value if bold else ''}{color.value if color else ''}{message}{ANSI.ENDC.value}",
    )


@singledispatch
def get_log_name(record: Entity) -> Optional[str]:
    try:
        if hasattr(record, "name"):
            return f"{type(record).__name__} [{getattr(record, 'name').root}]"
        return f"{type(record).__name__} [{record.entity.name.root}]"
    except Exception:
        return str(record)


@get_log_name.register
def _(record: OMetaTagAndClassification) -> str:
    """
    Given a LineageRequest, parse its contents to return
    a string that we can log
    """
    name = record.fqn.root if record.fqn else record.classification_request.name.root
    return f"{type(record).__name__} [{name}]"


@get_log_name.register
def _(record: AddLineageRequest) -> str:
    """
    Given a LineageRequest, parse its contents to return
    a string that we can log
    """

    # id and type will always be informed
    id_ = record.edge.fromEntity.id.root
    type_ = record.edge.fromEntity.type

    # name can be informed or not
    name_str = (
        f"name: {record.edge.fromEntity.name}, " if record.edge.fromEntity.name else ""
    )

    return f"{type_} [{name_str}id: {id_}]"


@get_log_name.register
def _(record: DeleteEntity) -> str:
    """
    Capture information about the deleted Entity
    """
    return f"{type(record.entity).__name__} [{record.entity.name.root}]"


@get_log_name.register
def _(record: OMetaLifeCycleData) -> str:
    """
    Capture the lifecycle changes of an Entity
    """
    return f"{record.entity.__name__} Lifecycle [{record.entity_fqn}]"


@get_log_name.register
def _(record: TableAndTests) -> str:
    if record.table:
        return f"Tests for [{record.table.fullyQualifiedName.root}]"

    return f"Test Suite [{record.executable_test_suite.name.root}]"


@get_log_name.register
def _(record: TestCaseResults) -> str:
    """We don't want to log this in the status"""
    return ",".join(set(result.testCase.name.root for result in record.test_results))


@get_log_name.register
def _(record: TestCaseResultResponse) -> str:
    return record.testCase.fullyQualifiedName.root


@get_log_name.register
def _(record: OMetaPipelineStatus) -> str:
    return f"Pipeline Status [{record.pipeline_fqn}]"


@get_log_name.register
def _(record: PatchRequest) -> str:
    """Get the log of the new entity"""
    return get_log_name(record.new_entity)


@get_log_name.register
def _(record: TableQueries) -> str:
    """Get the log of the TableQuery"""
    return f"Table Queries [{len(record.queries)}]"


@get_log_name.register
def _(record: QueryParserData) -> str:
    """Get the log of the ParsedData"""
    return f"Usage ParsedData [{len(record.parsedData)}]"


def redacted_config(config: Dict[str, Union[str, dict]]) -> Dict[str, Union[str, dict]]:
    config_copy = deepcopy(config)

    def traverse_and_modify(obj):
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key in REDACTED_KEYS:
                    obj[key] = "REDACTED"
                else:
                    traverse_and_modify(value)
        elif isinstance(obj, list):
            for item in obj:
                traverse_and_modify(item)

    traverse_and_modify(config_copy)
    return config_copy
