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
Helpers to import python classes and modules dynamically
"""
import importlib
import sys
import traceback
from enum import Enum
from typing import Any, Callable, Optional, Type, TypeVar

from pydantic import BaseModel

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.workflow import Sink as WorkflowSink
from metadata.ingestion.api.steps import BulkSink, Processor, Sink, Source, Stage
from metadata.utils.class_helper import get_service_type_from_source_type
from metadata.utils.client_version import get_client_version
from metadata.utils.constants import CUSTOM_CONNECTOR_PREFIX
from metadata.utils.logger import utils_logger
from metadata.utils.singleton import Singleton

logger = utils_logger()

T = TypeVar("T")
TYPE_SEPARATOR = "-"
CLASS_SEPARATOR = "_"
MODULE_SEPARATOR = "."


class DynamicImportException(Exception):
    """
    Raise it when having issues dynamically importing objects
    """

    def __init__(self, module: str, key: str = None, cause: Exception = None):
        self.module = module
        self.key = key
        self.cause = cause

    def __str__(self):
        import_path = self.module
        if self.key:
            import_path += f".{self.key}"
        return f"Cannot import {import_path} due to {self.cause}"


class MissingPluginException(Exception):
    """
    An excpetion that captures a missing openmetadata-ingestion plugin for a specific connector.
    """

    def __init__(self, plugin: str):
        self.plugin = plugin

    def __str__(self):
        try:
            version = "==" + get_client_version()
        except Exception:
            logger.warning("unable to get client version")
            logger.debug(traceback.format_exc())
            version = ""
        return (
            f"You might be missing the plugin [{self.plugin}]. Try:\n"
            f'pip install "openmetadata-ingestion[{self.plugin}]{version}"'
        )


def get_module_dir(type_: str) -> str:
    """
    Build the module directory in the ingestion package
    from a source type, e.g., mysql or clickhouse-lineage
    -> clickhouse
    """
    return type_.split(TYPE_SEPARATOR)[0]


def get_module_name(type_: str) -> str:
    """
    Build the module name in the ingestion package
    from a source type, e.g., query-parser
    -> query_parser
    """
    return type_.replace(TYPE_SEPARATOR, CLASS_SEPARATOR)


def get_source_module_name(type_: str) -> str:
    """
    Build the module name in the ingestion package
    from a source type, e.g.,
    mysql -> source
    clickhouse-lineage -> lineage
    """
    raw_module = type_.split(TYPE_SEPARATOR)[-1]

    if raw_module == type_:  # it is invariant, no TYPE_SEPARATOR in the string
        return "metadata"

    return raw_module


def get_class_name_root(type_: str) -> str:
    """
    Build the class name in the ingestion package
    from a source type, e.g., mysql or clickhouse-lineage
    -> ClickhouseLineage
    """
    return "".join([i.title() for i in type_.split(TYPE_SEPARATOR)]).replace(
        CLASS_SEPARATOR, ""
    )


def import_from_module(key: str) -> Type[Any]:
    """
    Dynamically import an object from a module path
    """

    module_name, obj_name = key.rsplit(MODULE_SEPARATOR, 1)
    try:
        obj = getattr(importlib.import_module(module_name), obj_name)
        return obj
    except Exception as err:
        logger.debug(traceback.format_exc())
        raise DynamicImportException(module=module_name, key=obj_name, cause=err)


# module building strings read better with .format instead of f-strings
# pylint: disable=consider-using-f-string
def import_source_class(
    service_type: ServiceType, source_type: str, from_: str = "ingestion"
) -> Type[Source]:
    return import_from_module(
        "metadata.{}.source.{}.{}.{}.{}Source".format(
            from_,
            service_type.name.lower(),
            get_module_dir(source_type),
            get_source_module_name(source_type),
            get_class_name_root(source_type),
        )
    )


def import_processor_class(
    processor_type: str, from_: str = "ingestion"
) -> Type[Processor]:
    return import_from_module(
        "metadata.{}.processor.{}.{}Processor".format(
            from_,
            get_module_name(processor_type),
            get_class_name_root(processor_type),
        )
    )


def import_stage_class(stage_type: str, from_: str = "ingestion") -> Type[Stage]:
    return import_from_module(
        "metadata.{}.stage.{}.{}Stage".format(
            from_,
            get_module_name(stage_type),
            get_class_name_root(stage_type),
        )
    )


def import_sink_class(sink_type: str, from_: str = "ingestion") -> Type[Sink]:
    return import_from_module(
        "metadata.{}.sink.{}.{}Sink".format(
            from_,
            get_module_name(sink_type),
            get_class_name_root(sink_type),
        )
    )


def import_bulk_sink_type(
    bulk_sink_type: str, from_: str = "ingestion"
) -> Type[BulkSink]:
    return import_from_module(
        "metadata.{}.bulksink.{}.{}BulkSink".format(
            from_,
            get_module_name(bulk_sink_type),
            get_class_name_root(bulk_sink_type),
        )
    )


def get_sink(
    sink_type: str,
    sink_config: WorkflowSink,
    metadata_config: OpenMetadataConnection,
    from_: str = "ingestion",
) -> Sink:
    """
    Import the sink class and create it
    from the given configs
    """
    sink_class = import_sink_class(sink_type=sink_type, from_=from_)
    sink_config = sink_config.model_dump().get("config", {})
    sink: Sink = sink_class.create(sink_config, metadata_config)
    logger.debug(f"Sink type:{sink_type}, {sink_class} configured")

    return sink


def import_connection_fn(connection: BaseModel, function_name: str) -> Callable:
    """
    Import get_connection and test_connection from sources
    """
    if not isinstance(connection, BaseModel):
        raise ValueError(
            "The connection is not a pydantic object. Is it really a connection class?"
        )

    connection_type: Optional[Enum] = getattr(connection, "type")
    if not connection_type:
        raise ValueError(
            f"Cannot get `type` property from connection {connection}. Check the JSON Schema."
        )

    service_type: ServiceType = get_service_type_from_source_type(connection_type.value)

    # module building strings read better with .format instead of f-strings
    # pylint: disable=consider-using-f-string

    if connection.type.value.lower().startswith(CUSTOM_CONNECTOR_PREFIX):
        python_class_parts = connection.sourcePythonClass.rsplit(".", 1)
        python_module_path = ".".join(python_class_parts[:-1])

        _connection_fn = import_from_module(
            "{}.{}".format(python_module_path, function_name)
        )
    else:
        _connection_fn = import_from_module(
            "metadata.ingestion.source.{}.{}.connection.{}".format(
                service_type.name.lower(),
                connection_type.value.lower(),
                function_name,
            )
        )

    return _connection_fn


def import_test_case_class(
    test_type: str,
    runner_type: str,
    test_definition: str,
) -> Type[BaseTestValidator]:
    """_summary_

    Args:
        test_type (str): column or table
        runner_type (str): sqlalchemy or pandas
        test_definition (str): test definition name
        test_definition_class (str): test definition class name (same as test_definition)

    Returns:
        Callable: test validator object
    """
    test_definition_class = (
        test_definition[0].upper() + test_definition[1:]
    )  # change test names to camel case
    return import_from_module(
        "metadata.data_quality.validations.{}.{}.{}.{}Validator".format(
            test_type.lower(),
            runner_type,
            test_definition,
            test_definition_class,
        )
    )


class SideEffectsLoader(metaclass=Singleton):
    modules = set(sys.modules.keys())

    def import_side_effects(self, *modules):
        """Handles loading of side effects and caches modules that have already been imported.
        Requires full module name."""
        for module in modules:
            if module not in self.modules:
                try:
                    module = importlib.import_module(module)
                    SideEffectsLoader.modules.add(module.__name__)
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    raise DynamicImportException(module=module, cause=err)
            else:
                logger.debug(f"Module {module} already imported")


def import_side_effects(*modules):
    SideEffectsLoader().import_side_effects(*modules)
