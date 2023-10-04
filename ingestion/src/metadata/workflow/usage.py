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
Usage Workflow Definition
"""

from metadata.ingestion.api.steps import BulkSink, Processor, Source, Stage
from metadata.utils.importer import (
    import_bulk_sink_type,
    import_from_module,
    import_processor_class,
    import_source_class,
    import_stage_class,
)
from metadata.utils.logger import ingestion_logger
from metadata.workflow.base import BaseWorkflow

logger = ingestion_logger()


class UsageWorkflow(BaseWorkflow):
    """
    Usage ingestion workflow implementation.
    """

    def set_steps(self):

        # We keep the source registered in the workflow
        self.source = self._get_source()
        processor = self._get_processor()
        stage = self._get_stage()
        bulk_sink = self._get_bulk_sink()

        self.steps = (processor, stage, bulk_sink)

    def _get_source(self) -> Source:
        # Source that we are ingesting, e.g., mysql, looker or kafka
        source_type = self.config.source.type.lower()

        source_class = (
            import_from_module(
                self.config.source.serviceConnection.__root__.config.sourcePythonClass
            )
            if source_type.startswith("custom")
            else import_source_class(
                service_type=self.service_type, source_type=source_type
            )
        )

        source: Source = source_class.create(self.config.source.dict(), self.metadata)
        logger.debug(f"Source type:{source_type},{source_class} configured")
        source.prepare()
        logger.debug(f"Source type:{source_type},{source_class}  prepared")

        return source

    def _get_processor(self) -> Processor:
        """Load the processor class"""
        processor_type = self.config.processor.type
        processor_class = import_processor_class(processor_type=processor_type)
        processor_config = self.config.processor.dict().get("config", {})
        processor: Processor = processor_class.create(
            processor_config,
            self.metadata_config,
            connection_type=str(
                self.config.source.serviceConnection.__root__.config.type.value
            ),
        )
        logger.debug(f"Processor Type: {processor_type}, {processor_class} configured")

        return processor

    def _get_stage(self) -> Stage:
        """Load the Stage class"""
        stage_type = self.config.stage.type
        stage_class = import_stage_class(stage_type=stage_type)
        stage_config = self.config.stage.dict().get("config", {})
        stage: Stage = stage_class.create(stage_config, self.metadata)
        logger.debug(f"Stage Type: {stage_type}, {stage_class} configured")

        return stage

    def _get_bulk_sink(self) -> BulkSink:
        """Load the BulkSink class"""
        bulk_sink_type = self.config.bulkSink.type
        bulk_sink_class = import_bulk_sink_type(bulk_sink_type=bulk_sink_type)
        bulk_sink_config = self.config.bulkSink.dict().get("config", {})
        bulk_sink: BulkSink = bulk_sink_class.create(bulk_sink_config, self.metadata)
        logger.info(
            f"BulkSink type:{self.config.bulkSink.type},{bulk_sink_class} configured"
        )

        return bulk_sink
