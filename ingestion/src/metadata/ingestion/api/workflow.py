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
Workflow definition for metadata related ingestions: metadata, lineage and usage.
"""
# module building strings read better with .format instead of f-strings
# pylint: disable=consider-using-f-string
import importlib
import traceback
from typing import Optional, Type, TypeVar

from metadata.config.common import WorkflowExecutionError
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseMetadataConfigType,
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.bulk_sink import BulkSink
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.processor import Processor
from metadata.ingestion.api.sink import Sink
from metadata.ingestion.api.source import Source
from metadata.ingestion.api.stage import Stage
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.class_helper import (
    get_service_class_from_service_type,
    get_service_type_from_source_type,
)
from metadata.utils.logger import ingestion_logger, set_loggers_level
from metadata.utils.workflow_output_handler import print_status

logger = ingestion_logger()

T = TypeVar("T")

SAMPLE_SOURCE = {"sample-data", "sample-usage"}


class InvalidWorkflowJSONException(Exception):
    """
    Raised when we cannot properly parse the workflow
    """


class Workflow:
    """
    Ingestion workflow implementation.

    It gets the data from the sources and passes it to
    the processor + sink or stage + bulk sink.
    """

    config: OpenMetadataWorkflowConfig
    source: Source
    processor: Processor
    stage: Stage
    sink: Sink
    bulk_sink: BulkSink
    report = {}

    def __init__(
        self, config: OpenMetadataWorkflowConfig
    ):  # pylint: disable=too-many-locals
        """
        Disabling pylint to wait for workflow reimplementation as a topology
        """
        self.config = config

        set_loggers_level(config.workflowConfig.loggerLevel.value)

        source_type = self.config.source.type.lower()

        service_type: ServiceType = get_service_type_from_source_type(
            self.config.source.type
        )

        metadata_config: OpenMetadataConnection = (
            self.config.workflowConfig.openMetadataServerConfig
        )

        self._retrieve_service_connection_if_needed(metadata_config, service_type)

        self._retrieve_dbt_config_source_if_needed(metadata_config, service_type)

        logger.info(f"Service type:{service_type},{source_type} configured")

        source_class = self.get(
            self.config.source.serviceConnection.__root__.config.sourcePythonClass
            if source_type.startswith("custom")
            else "metadata.ingestion.source.{}.{}.{}Source".format(
                service_type.name.lower(),
                self.type_class_fetch(source_type, True),
                self.type_class_fetch(source_type, False),
            )
        )

        self.source: Source = source_class.create(
            self.config.source.dict(), metadata_config
        )
        logger.debug(f"Source type:{source_type},{source_class} configured")
        self.source.prepare()
        logger.debug(f"Source type:{source_type},{source_class}  prepared")

        if self.config.processor:
            processor_type = self.config.processor.type
            processor_class = self.get(
                "metadata.ingestion.processor.{}.{}Processor".format(
                    self.type_class_fetch(processor_type, True),
                    self.type_class_fetch(processor_type, False),
                )
            )
            processor_config = self.config.processor.dict().get("config", {})
            self.processor: Processor = processor_class.create(
                processor_config, metadata_config
            )
            logger.debug(
                f"Processor Type: {processor_type}, {processor_class} configured"
            )

        if self.config.stage:
            stage_type = self.config.stage.type
            stage_class = self.get(
                "metadata.ingestion.stage.{}.{}Stage".format(
                    self.type_class_fetch(stage_type, True),
                    self.type_class_fetch(stage_type, False),
                )
            )
            stage_config = self.config.stage.dict().get("config", {})
            self.stage: Stage = stage_class.create(stage_config, metadata_config)
            logger.debug(f"Stage Type: {stage_type}, {stage_class} configured")

        if self.config.sink:
            sink_type = self.config.sink.type
            sink_class = self.get(
                "metadata.ingestion.sink.{}.{}Sink".format(
                    self.type_class_fetch(sink_type, True),
                    self.type_class_fetch(sink_type, False),
                )
            )
            sink_config = self.config.sink.dict().get("config", {})
            self.sink: Sink = sink_class.create(sink_config, metadata_config)
            logger.debug(f"Sink type:{self.config.sink.type},{sink_class} configured")

        if self.config.bulkSink:
            bulk_sink_type = self.config.bulkSink.type
            bulk_sink_class = self.get(
                "metadata.ingestion.bulksink.{}.{}BulkSink".format(
                    self.type_class_fetch(bulk_sink_type, True),
                    self.type_class_fetch(bulk_sink_type, False),
                )
            )
            bulk_sink_config = self.config.bulkSink.dict().get("config", {})
            self.bulk_sink: BulkSink = bulk_sink_class.create(
                bulk_sink_config, metadata_config
            )
            logger.info(
                f"BulkSink type:{self.config.bulkSink.type},{bulk_sink_class} configured"
            )

    def type_class_fetch(self, type_: str, is_file: bool):
        if is_file:
            return type_.replace("-", "_")

        return "".join([i.title() for i in type_.replace("-", "_").split("_")])

    def get(self, key: str) -> Optional[Type[T]]:
        if key.find(".") >= 0:
            # If the key contains a dot, we treat it as an import path and attempt
            # to load it dynamically.
            module_name, class_name = key.rsplit(".", 1)
            my_class = getattr(importlib.import_module(module_name), class_name)
            return my_class

        return None

    @classmethod
    def create(cls, config_dict: dict) -> "Workflow":
        config = parse_workflow_config_gracefully(config_dict)
        return cls(config)

    def execute(self):
        for record in self.source.next_record():
            self.report["Source"] = self.source.get_status().as_obj()
            if hasattr(self, "processor"):
                processed_record = self.processor.process(record)
            else:
                processed_record = record
            if hasattr(self, "stage"):
                self.stage.stage_record(processed_record)
                self.report["Stage"] = self.stage.get_status().as_obj()
            if hasattr(self, "sink"):
                self.sink.write_record(processed_record)
                self.report["sink"] = self.sink.get_status().as_obj()
        if hasattr(self, "bulk_sink"):
            self.stage.close()
            self.bulk_sink.write_records()
            self.report["Bulk_Sink"] = self.bulk_sink.get_status().as_obj()

    def stop(self):
        if hasattr(self, "processor"):
            self.processor.close()
        if hasattr(self, "bulk_sink"):
            self.bulk_sink.close()
        if hasattr(self, "sink"):
            self.sink.close()
        self.source.close()

    def raise_from_status(self, raise_warnings=False):
        if self.source.get_status().failures:
            raise WorkflowExecutionError(
                "Source reported errors", self.source.get_status()
            )
        if hasattr(self, "sink") and self.sink.get_status().failures:
            raise WorkflowExecutionError("Sink reported errors", self.sink.get_status())
        if hasattr(self, "stage") and self.stage.get_status().failures:
            raise WorkflowExecutionError(
                "stage reported errors", self.stage.get_status()
            )
        if hasattr(self, "bulk_sink") and self.bulk_sink.get_status().failures:
            raise WorkflowExecutionError(
                "Bulk Sink reported errors", self.bulk_sink.get_status()
            )
        if raise_warnings and (
            self.source.get_status().warnings or self.sink.get_status().warnings
        ):
            raise WorkflowExecutionError(
                "Source reported warnings", self.source.get_status()
            )

    def print_status(self):
        """
        Print the workflow results with click
        """
        print_status(self)

    def result_status(self) -> int:
        """
        Returns 1 if status is failed, 0 otherwise.
        """
        if self.source.get_status().failures or (
            hasattr(self, "sink") and self.sink.get_status().failures
        ):
            return 1

        return 0

    def _retrieve_service_connection_if_needed(
        self, metadata_config: OpenMetadataConnection, service_type: ServiceType
    ) -> None:
        """
        We override the current `serviceConnection` source config object if source workflow service already exists
        in OM. When secrets' manager is configured, we retrieve the service connection from the secrets' manager.
        Otherwise, we get the service connection from the service object itself through the default `SecretsManager`.

        :param metadata_config: OpenMetadata connection config
        :param service_type: source workflow service type
        :return:
        """
        if service_type is not ServiceType.Metadata and not self._is_sample_source(
            self.config.source.type
        ):
            service_name = self.config.source.serviceName
            metadata = OpenMetadata(config=metadata_config)
            try:
                service = metadata.get_by_name(
                    get_service_class_from_service_type(service_type),
                    service_name,
                )
                if service:
                    self.config.source.serviceConnection = (
                        metadata.secrets_manager_client.retrieve_service_connection(
                            service, service_type.name.lower()
                        )
                    )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error getting dbtConfigSource for service name [{service_name}]"
                    f" using the secrets manager provider [{metadata.config.secretsManagerProvider}]: {exc}"
                )

    def _retrieve_dbt_config_source_if_needed(
        self, metadata_config: OpenMetadataConnection, service_type: ServiceType
    ) -> None:
        """
        We override the current `config` source config object if it is a metadata ingestion type. When secrets' manager
        is configured, we retrieve the config from the secrets' manager. Otherwise, we get the config from the source
        config object itself through the default `SecretsManager`.

        :return:
        """
        config = self.config.source.sourceConfig.config
        if (
            service_type is ServiceType.Database
            and config
            and config.type == DatabaseMetadataConfigType.DatabaseMetadata
        ):
            metadata = OpenMetadata(config=metadata_config)
            try:
                dbt_config_source: object = (
                    metadata.secrets_manager_client.retrieve_dbt_source_config(
                        self.config.source.sourceConfig,
                        self.config.source.serviceName,
                    )
                )
                if dbt_config_source:
                    config_dict = config.dict()
                    config_dict["dbtConfigSource"] = dbt_config_source
                    self.config.source.sourceConfig.config = (
                        DatabaseServiceMetadataPipeline.parse_obj(config_dict)
                    )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error getting dbtConfigSource for config [{config}] using the secrets manager"
                    f" provider [{metadata.config.secretsManagerProvider}]: {exc}"
                )

    @staticmethod
    def _is_sample_source(service_type: str) -> bool:
        return service_type in SAMPLE_SOURCE
