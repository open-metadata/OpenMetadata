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
Pipeline Observability Processor

Processes pipeline observability data from PipelineProfilerSource
and validates/transforms it before staging.
"""
import traceback
from typing import Optional

from metadata.config.common import ConfigModel
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Processor
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.pipeline_profiler_source import (
    TablePipelineObservability,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PipelineObservabilityProcessor(Processor):
    """
    Processor for pipeline observability data.
    
    Validates and transforms TablePipelineObservability objects
    from pipeline profiler sources.
    """

    config: ConfigModel

    def __init__(self, config: ConfigModel, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.metadata = metadata

    @classmethod
    def create(
        cls, config_dict: dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None, **kwargs
    ):
        config = ConfigModel.model_validate(config_dict or {})
        return cls(config, metadata)

    def _run(self, record: TablePipelineObservability) -> Either[TablePipelineObservability]:
        """
        Process pipeline observability data.
        
        Args:
            record: TablePipelineObservability from pipeline profiler source
            
        Returns:
            Either validated TablePipelineObservability or error
        """
        try:
            # Validate the record
            if not record.table:
                return Either(left="Missing table entity in pipeline observability record")
            
            if not record.observability_data:
                return Either(left="Missing observability data in record")
            
            # Validate each observability entry
            for obs_data in record.observability_data:
                if not obs_data.pipeline:
                    logger.warning(
                        f"Pipeline observability entry missing pipeline reference for table {record.table.fullyQualifiedName}"
                    )
                    continue
                
                # Additional validation can be added here
                logger.debug(
                    f"Processing observability data for pipeline {obs_data.pipeline.fullyQualifiedName} "
                    f"and table {record.table.fullyQualifiedName}"
                )
            
            return Either(right=record)
            
        except Exception as exc:
            logger.error(f"Failed to process pipeline observability record: {exc}")
            logger.debug(traceback.format_exc())
            return Either(left=f"Failed to process pipeline observability: {exc}")

    def close(self):
        """
        Nothing to close
        """

    @property
    def name(self) -> str:
        return "Pipeline Observability Processor"
