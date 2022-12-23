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

from metadata.generated.schema.entity.services.serviceType import ServiceType
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


def get_module_name(type_: str) -> str:
    """
    Build the module name in the ingestion package
    from a source type, e.g., mysql or clickhouse-lineage
    -> clickhouse_lineage
    """
    return type_.replace(TYPE_SEPARATOR, CLASS_SEPARATOR)


def get_class_name(type_: str) -> str:
    """
    Build the class name in the ingestion package
    from a source type, e.g., mysql or clickhouse-lineage
    -> ClickhouseLineage
    """
    return "".join([i.title() for i in type_.split(TYPE_SEPARATOR)])


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
def import_source_class(service_type: ServiceType, source_type: str) -> Type[Source]:
    return import_class(
        "metadata.ingestion.source.{}.{}.{}Source".format(
            service_type.name.lower(),
            get_module_name(source_type),
            get_class_name(source_type),
        )
    )


def import_processor_class(processor_type: str) -> Type[Processor]:
    return import_class(
        "metadata.ingestion.processor.{}.{}Processor".format(
            get_module_name(processor_type),
            get_class_name(processor_type),
        )
    )


def import_stage_class(stage_type: str) -> Type[Stage]:
    return import_class(
        "metadata.ingestion.stage.{}.{}Stage".format(
            get_module_name(stage_type),
            get_class_name(stage_type),
        )
    )


def import_sink_class(sink_type: str) -> Type[Sink]:
    return import_class(
        "metadata.ingestion.sink.{}.{}Sink".format(
            get_module_name(sink_type),
            get_class_name(sink_type),
        )
    )


def import_bulk_sink_type(bulk_sink_type: str) -> Type[BulkSink]:
    return import_class(
        "metadata.ingestion.bulksink.{}.{}BulkSink".format(
            get_module_name(bulk_sink_type),
            get_class_name(bulk_sink_type),
        )
    )
