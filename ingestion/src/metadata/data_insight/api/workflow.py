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
Workflow definition for the ORM Profiler.

- How to specify the source
- How to specify the entities to run
- How to define metrics & tests
"""

from __future__ import annotations

import traceback
from typing import Optional, Union, cast

from pydantic import ValidationError

from metadata.config.common import WorkflowExecutionError
from metadata.config.workflow import get_sink
from metadata.data_insight.processor.data_processor import DataProcessor
from metadata.data_insight.processor.entity_report_data_processor import (
    EntityReportDataProcessor,
)
from metadata.data_insight.processor.web_analytic_report_data_processor import (
    WebAnalyticEntityViewReportDataProcessor,
    WebAnalyticUserActivityReportDataProcessor,
)
from metadata.generated.schema.analytics.reportData import ReportDataType
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Sink,
)
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.processor import ProcessorStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import data_insight_logger
from metadata.utils.workflow_helper import (
    set_ingestion_pipeline_status as set_ingestion_pipeline_status_helper,
)
from metadata.utils.workflow_output_handler import print_data_insight_status

logger = data_insight_logger()


class DataInsightWorkflow:
    """
    Configure and run the Data Insigt workflow

    Attributes:
    """

    def __init__(self, config: OpenMetadataWorkflowConfig) -> None:
        self.config = config
        self.metadata_config: OpenMetadataConnection = (
            self.config.workflowConfig.openMetadataServerConfig
        )
        self.metadata = OpenMetadata(self.metadata_config)
        self.set_ingestion_pipeline_status(state=PipelineState.running)

        self.status = ProcessorStatus()
        self.data_processor: Optional[
            Union[
                DataProcessor,
                EntityReportDataProcessor,
                WebAnalyticEntityViewReportDataProcessor,
                WebAnalyticUserActivityReportDataProcessor,
            ]
        ] = None

        if self.config.sink:
            self.sink = get_sink(
                sink_type="metadata-rest",
                sink_config=Sink(type="metadata-rest", config={}),  # type: ignore
                metadata_config=self.metadata_config,
                _from="data_insight",
            )

            self.es_sink = get_sink(
                sink_type=self.config.sink.type,
                sink_config=self.config.sink,
                metadata_config=self.metadata_config,
                _from="ingestion",
            )

    @classmethod
    def create(cls, config_dict: dict) -> DataInsightWorkflow:
        """instantiate a class object

        Args:
            config_dict (dict): workflow config

        Raises:
            err: wrong config

        Returns:
            DataInsightWorkflow
        """
        try:
            config = parse_workflow_config_gracefully(config_dict)
            config = cast(OpenMetadataWorkflowConfig, config)  # for static type checked
            return cls(config)
        except ValidationError as err:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error trying to parse the Profiler Workflow configuration: {err}"
            )
            raise err

    def execute(self):
        for report_data_type in ReportDataType:
            try:
                self.data_processor = DataProcessor.create(
                    _data_processor_type=report_data_type.value, metadata=self.metadata
                )
                for record in self.data_processor.process():
                    if hasattr(self, "sink"):
                        self.sink.write_record(record)
                        self.es_sink.write_record(record)

            except Exception as exc:
                logger.error(
                    f"Error while executing data insight workflow for report type {report_data_type} -- {exc}"
                )
                logger.debug(traceback.format_exc())
                self.status.failure(
                    f"Error while executing data insight workflow for report type {report_data_type} -- {exc}"
                )

    def raise_from_status(self, raise_warnings=False):
        if self.data_processor and self.data_processor.get_status().failures:
            raise WorkflowExecutionError(
                "Source reported errors", self.data_processor.get_status()
            )
        if hasattr(self, "sink") and self.sink.get_status().failures:
            raise WorkflowExecutionError("Sink reported errors", self.sink.get_status())
        if raise_warnings and (
            (self.data_processor and self.data_processor.get_status().warnings)
            or self.sink.get_status().warnings
        ):
            raise WorkflowExecutionError(
                "Source reported warnings",
                self.data_processor.get_status() if self.data_processor else None,
            )

    def print_status(self) -> None:
        print_data_insight_status(self)

    def result_status(self) -> int:
        """
        Returns 1 if status is failed, 0 otherwise.
        """
        if (
            (self.data_processor and self.data_processor.get_status().failures)
            or self.status.failures
            or (hasattr(self, "sink") and self.sink.get_status().failures)
        ):
            return 1
        return 0

    def stop(self):
        """
        Close all connections
        """
        self.set_ingestion_pipeline_status(PipelineState.success)
        self.metadata.close()

    def set_ingestion_pipeline_status(self, state: PipelineState):
        """
        Method to set the pipeline status of current ingestion pipeline
        """
        pipeline_run_id = set_ingestion_pipeline_status_helper(
            state=state,
            ingestion_pipeline_fqn=self.config.ingestionPipelineFQN,
            pipeline_run_id=self.config.pipelineRunId,
            metadata=self.metadata,
        )
        self.config.pipelineRunId = pipeline_run_id
