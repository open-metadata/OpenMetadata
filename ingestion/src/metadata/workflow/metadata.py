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

from metadata.ingestion.api.steps import Sink, Source
from metadata.utils.importer import (
    import_from_module,
    import_sink_class,
    import_source_class,
)
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

    def _get_sink(self) -> Sink:
        sink_type = self.config.sink.type
        sink_class = import_sink_class(sink_type=sink_type)
        sink_config = self.config.sink.dict().get("config", {})
        sink: Sink = sink_class.create(sink_config, self.metadata)
        logger.debug(f"Sink type:{self.config.sink.type}, {sink_class} configured")

        return sink
