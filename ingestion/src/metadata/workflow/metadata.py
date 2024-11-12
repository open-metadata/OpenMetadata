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
Workflow definition for metadata related ingestions: metadata and lineage.
"""

from metadata.config.common import WorkflowExecutionError
from metadata.ingestion.api.steps import Sink, Source
from metadata.utils.importer import import_sink_class
from metadata.utils.logger import ingestion_logger
from metadata.workflow.ingestion import IngestionWorkflow

logger = ingestion_logger()


class MetadataWorkflow(IngestionWorkflow):
    """
    Metadata ingestion workflow implementation.
    """

    def set_steps(self):
        # We keep the source registered in the workflow
        self.source = self._get_source()
        sink = self._get_sink()

        self.steps = (sink,)

    def _get_source(self) -> Source:
        # Source that we are ingesting, e.g., mysql, looker or kafka
        source_type = self.config.source.type.lower()
        if not self.config.source.serviceName:
            raise WorkflowExecutionError(
                "serviceName is required field for executing the Metadata Workflow. "
                "You can find more information on how to build the YAML "
                "configuration here: https://docs.open-metadata.org/connectors"
            )

        source_class = self.import_source_class()

        pipeline_name = (
            self.ingestion_pipeline.fullyQualifiedName.root
            if self.ingestion_pipeline
            else None
        )

        source: Source = source_class.create(
            self.config.source.model_dump(), self.metadata, pipeline_name
        )
        logger.debug(f"Source type:{source_type},{source_class} configured")
        source.prepare()
        logger.debug(f"Source type:{source_type},{source_class}  prepared")

        return source

    def _get_sink(self) -> Sink:
        sink_type = self.config.sink.type
        sink_class = import_sink_class(sink_type=sink_type)
        sink_config = self.config.sink.model_dump().get("config", {})
        sink: Sink = sink_class.create(sink_config, self.metadata)
        logger.debug(f"Sink type:{self.config.sink.type}, {sink_class} configured")

        return sink
