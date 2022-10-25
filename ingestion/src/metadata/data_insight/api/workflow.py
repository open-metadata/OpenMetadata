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
from typing import cast

from pydantic import ValidationError

from metadata.config.workflow import get_sink
from metadata.data_insight.processor.data_processor import DataProcessor
from metadata.generated.schema.analytics.reportData import ReportDataType
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Sink,
)
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.helpers import calculate_execution_time
from metadata.utils.logger import data_insight_logger

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

        if self.config.sink:
            self.sink = get_sink(
                sink_type="metadata-rest",
                sink_config=Sink(type="metadata-rest", config={}),
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

    @calculate_execution_time
    def execute(self):
        for report_data_type in ReportDataType:
            data_processor: DataProcessor = DataProcessor.create(
                _data_processor_type=report_data_type.value, metadata=self.metadata
            )
            for record in data_processor.process():
                if hasattr(self, "sink"):
                    self.sink.write_record(record)
                    self.es_sink.write_record(record)
