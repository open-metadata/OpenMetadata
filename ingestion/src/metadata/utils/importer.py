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
import traceback
from typing import Type, TypeVar

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.workflow import Sink as WorkflowSink
from metadata.ingestion.api.bulk_sink import BulkSink
from metadata.ingestion.api.processor import Processor
from metadata.ingestion.api.sink import Sink
from metadata.ingestion.api.source import Source
from metadata.ingestion.api.stage import Stage
from metadata.utils.logger import utils_logger

logger = utils_logger()

T = TypeVar("T")
TYPE_SEPARATOR = "-"
CLASS_SEPARATOR = "_"
MODULE_SEPARATOR = "."


class ImportClassException(Exception):
    """
    Raise it when having issues dynamically importing classes
    """


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


def import_class(key: str) -> Type[T]:
    """
    Dynamically import a class from a module path
    """

    try:
        module_name, class_name = key.rsplit(MODULE_SEPARATOR, 1)
        my_class = getattr(importlib.import_module(module_name), class_name)
        return my_class
    except Exception as err:
        logger.debug(traceback.format_exc())
        raise ImportClassException(f"Cannot load class from {key} due to {err}")


# module building strings read better with .format instead of f-strings
# pylint: disable=consider-using-f-string
def import_source_class(
    service_type: ServiceType, source_type: str, from_: str = "ingestion"
) -> Type[Source]:
    return import_class(
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
    return import_class(
        "metadata.{}.processor.{}.{}Processor".format(
            from_,
            get_module_name(processor_type),
            get_class_name_root(processor_type),
        )
    )


def import_stage_class(stage_type: str, from_: str = "ingestion") -> Type[Stage]:
    return import_class(
        "metadata.{}.stage.{}.{}Stage".format(
            from_,
            get_module_name(stage_type),
            get_class_name_root(stage_type),
        )
    )


def import_sink_class(sink_type: str, from_: str = "ingestion") -> Type[Sink]:
    return import_class(
        "metadata.{}.sink.{}.{}Sink".format(
            from_,
            get_module_name(sink_type),
            get_class_name_root(sink_type),
        )
    )


def import_bulk_sink_type(
    bulk_sink_type: str, from_: str = "ingestion"
) -> Type[BulkSink]:
    return import_class(
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
    sink_config = sink_config.dict().get("config", {})
    sink: Sink = sink_class.create(sink_config, metadata_config)
    logger.debug(f"Sink type:{sink_type}, {sink_class} configured")

    return sink
