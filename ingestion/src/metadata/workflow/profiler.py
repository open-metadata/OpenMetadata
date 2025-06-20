#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Workflow definition for the profiler
"""

from metadata.ingestion.api.steps import Processor, Sink
from metadata.ingestion.source.connections import test_connection_common
from metadata.profiler.processor.processor import ProfilerProcessor
from metadata.profiler.source.metadata import OpenMetadataSource
from metadata.profiler.source.metadata_ext import OpenMetadataSourceExt
from metadata.utils.helpers import retry_with_docker_host
from metadata.utils.importer import import_sink_class
from metadata.utils.logger import profiler_logger
from metadata.utils.ssl_manager import get_ssl_connection
from metadata.workflow.ingestion import IngestionWorkflow

logger = profiler_logger()


class ProfilerWorkflow(IngestionWorkflow):
    """
    Profiler ingestion workflow implementation

    We check the source connection test when initializing
    this workflow. No need to do anything here if this does not pass
    """

    def _get_source_class(self):
        if self.config.source.serviceName:
            self.import_source_class()
            return OpenMetadataSource
        logger.info(
            "Database Service name not provided, we will scan all the tables "
            "available within data source and locate table entity in OpenMetadata "
            "to ingest profiler data."
        )
        return OpenMetadataSourceExt

    def set_steps(self):
        # TODO: Clean after https://github.com/open-metadata/OpenMetadata/issues/21259
        # We are forcing the secret evaluation to "ignore" null secrets down the line
        # Remove this when the issue above is fixed and empty secrets migrated
        source_config_class = type(self.config.source.serviceConnection.root.config)
        dumped_config = self.config.source.serviceConnection.root.config.model_dump()
        self.config.source.serviceConnection.root.config = (
            source_config_class.model_validate(dumped_config)
        )

        # NOTE: Call test_connection to update host value before creating the source class
        self.test_connection()

        source_class = self._get_source_class()
        self.source = source_class.create(self.config.model_dump(), self.metadata)

        profiler_processor = self._get_profiler_processor()
        sink = self._get_sink()

        self.steps = (profiler_processor, sink)

    def test_connection(self) -> None:
        @retry_with_docker_host(config=self.config.source)
        def main(self):
            service_config = self.config.source.serviceConnection.root.config
            conn = get_ssl_connection(service_config)

            test_connection_common(self.metadata, conn, service_config)

        return main(self)

    def _get_sink(self) -> Sink:
        sink_type = self.config.sink.type
        sink_class = import_sink_class(sink_type=sink_type)
        sink_config = self.config.sink.model_dump().get("config", {})
        sink: Sink = sink_class.create(sink_config, self.metadata)
        logger.debug(f"Sink type:{self.config.sink.type}, {sink_class} configured")

        return sink

    def _get_profiler_processor(self) -> Processor:
        return ProfilerProcessor.create(self.config.model_dump(), self.metadata)
