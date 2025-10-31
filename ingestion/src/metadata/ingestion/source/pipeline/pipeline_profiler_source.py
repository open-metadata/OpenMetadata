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
Pipeline Profiler Source Module

Base class for ingesting pipeline observability data into table entities
"""
import traceback
from abc import ABC, abstractmethod
from typing import Dict, Iterable, List

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.type.pipelineObservability import PipelineObservability
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Source
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class TablePipelineObservability(BaseModel):
    """
    Model to represent table with its pipeline observability data
    """

    table: Table
    observability_data: List[PipelineObservability]


class PipelineProfilerSource(Source, ABC):
    """
    Base class for all pipeline profiler ingestion.

    Extract pipeline observability data and map it to table entities
    that the pipelines process.
    """

    def __init__(self, config, metadata: OpenMetadata):
        self.config = config
        self.metadata = metadata
        self.source_config = (
            self.config.sourceConfig.config if self.config.sourceConfig else None
        )
        super().__init__()

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name=None):
        """
        Create method for pipeline profiler sources
        """
        from metadata.generated.schema.metadataIngestion.workflow import (
            Source as WorkflowSource,
        )

        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        return cls(config, metadata)

    @abstractmethod
    def get_table_pipeline_observability(
        self,
    ) -> Iterable[Dict[str, List[PipelineObservability]]]:
        """
        Method to extract pipeline observability data grouped by table FQN.
        This method should be implemented by each pipeline service.

        Returns:
            Dict mapping table FQN to list of PipelineObservability objects
        """

    def _iter(self) -> Iterable[Either[TablePipelineObservability]]:
        """
        Iterate through tables and their associated pipeline observability data
        """
        try:
            for table_observability_map in self.get_table_pipeline_observability():
                for table_fqn, observability_list in table_observability_map.items():
                    # Get the table entity from OpenMetadata
                    table = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
                    if table:
                        yield Either(
                            right=TablePipelineObservability(
                                table=table, observability_data=observability_list
                            )
                        )
                    else:
                        logger.warning(f"Table not found: {table_fqn}")
        except Exception as exc:
            logger.error(f"Failed to extract pipeline observability data: {exc}")
            logger.debug(traceback.format_exc())
            yield Either(
                left=StackTraceError(
                    name="Pipeline Profiler Source",
                    error=f"Failed to extract pipeline observability data: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def prepare(self):
        """
        Prepare the source for ingestion
        """
        pass

    def test_connection(self) -> None:
        """
        Test connection to the pipeline service
        """
        pass

    def close(self):
        """
        Clean up resources
        """
        pass

    def get_db_service_names(self) -> List[str]:
        """
        Get the list of db service names for mapping pipeline observability to table entities
        """
        return (
            self.source_config.dbServiceNames or ["*"] if self.source_config else ["*"]
        )
