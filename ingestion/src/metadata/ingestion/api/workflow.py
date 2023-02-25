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
import traceback
from typing import Optional, TypeVar, cast

from metadata.config.common import WorkflowExecutionError
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.bulk_sink import BulkSink
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.processor import Processor
from metadata.ingestion.api.sink import Sink
from metadata.ingestion.api.source import Source
from metadata.ingestion.api.stage import Stage
from metadata.ingestion.models.custom_types import ServiceWithConnectionType
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.timer.repeated_timer import RepeatedTimer
from metadata.timer.workflow_reporter import get_ingestion_status_timer
from metadata.utils.class_helper import (
    get_service_class_from_service_type,
    get_service_type_from_source_type,
)
from metadata.utils.importer import (
    import_bulk_sink_type,
    import_from_module,
    import_processor_class,
    import_sink_class,
    import_source_class,
    import_stage_class,
)
from metadata.utils.logger import ingestion_logger, set_loggers_level
from metadata.utils.workflow_output_handler import print_status
from metadata.workflow.workflow_status_mixin import WorkflowStatusMixin

logger = ingestion_logger()

T = TypeVar("T")

SUCCESS_THRESHOLD_VALUE = 90
REPORTS_INTERVAL_SECONDS = 30


class InvalidWorkflowJSONException(Exception):
    """
    Raised when we cannot properly parse the workflow
    """


class Workflow(WorkflowStatusMixin):
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
        self._timer: Optional[RepeatedTimer] = None

        set_loggers_level(config.workflowConfig.loggerLevel.value)

        # Source that we are ingesting, e.g., mysql, looker or kafka
        source_type = self.config.source.type.lower()

        # Type of the source: Database, Dashboard, Messaging, Pipeline, Metadata or Mlmodel
        service_type: ServiceType = get_service_type_from_source_type(
            self.config.source.type
        )

        metadata_config: OpenMetadataConnection = (
            self.config.workflowConfig.openMetadataServerConfig
        )

        self.metadata = OpenMetadata(config=metadata_config)

        self.set_ingestion_pipeline_status(state=PipelineState.running)

        self._retrieve_service_connection_if_needed(service_type)

        logger.info(f"Service type:{service_type},{source_type} configured")

        source_class = (
            import_from_module(
                self.config.source.serviceConnection.__root__.config.sourcePythonClass
            )
            if source_type.startswith("custom")
            else import_source_class(service_type=service_type, source_type=source_type)
        )

        self.source: Source = source_class.create(
            self.config.source.dict(), metadata_config
        )
        logger.debug(f"Source type:{source_type},{source_class} configured")
        self.source.prepare()
        logger.debug(f"Source type:{source_type},{source_class}  prepared")

        if self.config.processor:
            processor_type = self.config.processor.type
            processor_class = import_processor_class(processor_type=processor_type)
            processor_config = self.config.processor.dict().get("config", {})
            self.processor: Processor = processor_class.create(
                processor_config,
                metadata_config,
                connection_type=str(
                    self.config.source.serviceConnection.__root__.config.type.value
                ),
            )
            logger.debug(
                f"Processor Type: {processor_type}, {processor_class} configured"
            )

        if self.config.stage:
            stage_type = self.config.stage.type
            stage_class = import_stage_class(stage_type=stage_type)
            stage_config = self.config.stage.dict().get("config", {})
            self.stage: Stage = stage_class.create(stage_config, metadata_config)
            logger.debug(f"Stage Type: {stage_type}, {stage_class} configured")

        if self.config.sink:
            sink_type = self.config.sink.type
            sink_class = import_sink_class(sink_type=sink_type)
            sink_config = self.config.sink.dict().get("config", {})
            self.sink: Sink = sink_class.create(sink_config, metadata_config)
            logger.debug(f"Sink type:{self.config.sink.type},{sink_class} configured")

        if self.config.bulkSink:
            bulk_sink_type = self.config.bulkSink.type
            bulk_sink_class = import_bulk_sink_type(bulk_sink_type=bulk_sink_type)
            bulk_sink_config = self.config.bulkSink.dict().get("config", {})
            self.bulk_sink: BulkSink = bulk_sink_class.create(
                bulk_sink_config, metadata_config
            )
            logger.info(
                f"BulkSink type:{self.config.bulkSink.type},{bulk_sink_class} configured"
            )

    @property
    def timer(self) -> RepeatedTimer:
        """Status timer"""
        if not self._timer:
            self._timer = get_ingestion_status_timer(
                interval=REPORTS_INTERVAL_SECONDS, logger=logger, workflow=self
            )

        return self._timer

    @classmethod
    def create(cls, config_dict: dict) -> "Workflow":
        config = parse_workflow_config_gracefully(config_dict)
        return cls(config)

    def execute(self):
        """
        Pass each record from the source down the pipeline:
        Source -> (Processor) -> Sink
        or Source -> (Processor) -> Stage -> BulkSink
        """
        self.timer.trigger()

        try:
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

            # If we reach this point, compute the success % and update the associated Ingestion Pipeline status
            self.update_ingestion_status_at_end()

        # Any unhandled exception breaking the workflow should update the status
        except Exception as err:
            self.set_ingestion_pipeline_status(PipelineState.failed)
            raise err

        # Force resource closing. Required for killing the threading
        finally:
            self.stop()

    def stop(self):
        if hasattr(self, "processor"):
            self.processor.close()
        if hasattr(self, "bulk_sink"):
            self.bulk_sink.close()
        if hasattr(self, "sink"):
            self.sink.close()

        self.source.close()
        self.timer.stop()

    def _get_source_success(self):
        return self.source.get_status().calculate_success()

    def update_ingestion_status_at_end(self):
        """
        Once the execute method is done, update the status
        as OK or KO depending on the success rate.
        """
        pipeline_state = PipelineState.success
        if (
            self._get_source_success() >= SUCCESS_THRESHOLD_VALUE
            and self._get_source_success() < 100
        ):
            pipeline_state = PipelineState.partialSuccess
        self.set_ingestion_pipeline_status(pipeline_state)

    def _raise_from_status_internal(self, raise_warnings=False):
        """
        Method to raise error if failed execution
        """
        if (
            self.source.get_status().failures
            and self._get_source_success() < SUCCESS_THRESHOLD_VALUE
        ):
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

    def _retrieve_service_connection_if_needed(self, service_type: ServiceType) -> None:
        """
        We override the current `serviceConnection` source config object if source workflow service already exists
        in OM. When secrets' manager is configured, we retrieve the service connection from the secrets' manager.
        Otherwise, we get the service connection from the service object itself through the default `SecretsManager`.

        :param service_type: source workflow service type
        :return:
        """
        if not self.config.source.serviceConnection:
            service_name = self.config.source.serviceName
            try:
                service: ServiceWithConnectionType = cast(
                    ServiceWithConnectionType,
                    self.metadata.get_by_name(
                        get_service_class_from_service_type(service_type),
                        service_name,
                    ),
                )
                if service:
                    self.config.source.serviceConnection = ServiceConnection(
                        __root__=service.connection
                    )
                else:
                    raise InvalidWorkflowJSONException(
                        "The serviceConnection is not informed and we cannot retrieve it from the API"
                        f" by searching for the service name [{service_name}]. Does this service exist in OpenMetadata?"
                    )
            except InvalidWorkflowJSONException as exc:
                raise exc
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Unknown error getting service connection for service name [{service_name}]"
                    f" using the secrets manager provider [{self.metadata.config.secretsManagerProvider}]: {exc}"
                )
