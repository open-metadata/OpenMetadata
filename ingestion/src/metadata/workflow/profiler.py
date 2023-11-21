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
Workflow definition for the profiler
"""
from typing import Iterable, Tuple

from pydantic import BaseModel
from pyspark.sql import SparkSession

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.steps import Processor, Sink, Stage
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.pii.processor import PIIProcessor
from metadata.profiler.processor.processor import ProfilerProcessor
from metadata.profiler.source.metadata import OpenMetadataSource
from metadata.profiler.source.metadata_ext import OpenMetadataSourceExt
from metadata.utils.importer import import_sink_class
from metadata.utils.logger import profiler_logger
from metadata.workflow.ingestion import IngestionWorkflow

logger = profiler_logger()


class DataAndStepWrapper(BaseModel):
    from metadata.profiler.source.metadata import ProfilerSourceAndEntity

    steps: Tuple
    record: ProfilerSourceAndEntity


class ProfilerWorkflow(IngestionWorkflow):
    """
    Profiler ingestion workflow implementation

    We check the source connection test when initializing
    this workflow. No need to do anything here if this does not pass
    """

    @staticmethod
    def _execute_internal(data: DataAndStepWrapper) -> None:
        """
        This method is made static, because otherwise it leads to PicklingError
        while collecting the data from during parallel processing
        """
        processed_record = data.record

        for step in data.steps:
            # We only process the records for these Step types
            if processed_record is not None and isinstance(
                step, (Processor, Stage, Sink)
            ):
                processed_record = step.run(processed_record)

    def _get_source_data(self) -> Iterable[DataAndStepWrapper]:
        """
        Method to wrap the source results with steps
        """
        for record in self.source.run():
            yield DataAndStepWrapper(record=record, steps=self.steps)

    def execute_internal(self):
        """
        Internal execution that needs to be filled
        by each ingestion workflow.

        Pass each record from the source down the pipeline:
        Source -> (Processor) -> Sink
        or Source -> (Processor) -> Stage -> BulkSink

        Note how the Source class needs to be an Iterator. Specifically,
        we are defining Sources as Generators.
        """
        spark = SparkSession.builder.appName("OpenMetadata").getOrCreate()
        rdd = spark.sparkContext.parallelize(self._get_source_data())
        rdd.map(ProfilerWorkflow._execute_internal).collect()

    def __init__(self, config: OpenMetadataWorkflowConfig):
        super().__init__(config)

        # Validate that we can properly reach the source database
        self.test_connection()

    def _get_source_class(self):
        if self.config.source.serviceName:
            return OpenMetadataSource
        logger.info(
            "Database Service name not provided, we will scan all the tables"
            "available within data source and locate table entity in OpenMetadata"
            "to ingest profiler data."
        )
        return OpenMetadataSourceExt

    def set_steps(self):
        source_class = self._get_source_class()
        self.source = source_class.create(self.config.dict(), self.metadata)

        profiler_processor = self._get_profiler_processor()
        pii_processor = self._get_pii_processor()
        sink = self._get_sink()
        self.steps = (profiler_processor, pii_processor, sink)

    def test_connection(self):
        service_config = self.config.source.serviceConnection.__root__.config
        conn = get_connection(service_config)

        test_connection_fn = get_test_connection_fn(service_config)
        test_connection_fn(self.metadata, conn, service_config)

    def _get_sink(self) -> Sink:
        sink_type = self.config.sink.type
        sink_class = import_sink_class(sink_type=sink_type)
        sink_config = self.config.sink.dict().get("config", {})
        sink: Sink = sink_class.create(sink_config, self.metadata)
        logger.debug(f"Sink type:{self.config.sink.type}, {sink_class} configured")

        return sink

    def _get_profiler_processor(self) -> Processor:
        return ProfilerProcessor.create(self.config.dict(), self.metadata)

    def _get_pii_processor(self) -> Processor:
        return PIIProcessor.create(self.config.dict(), self.metadata)
