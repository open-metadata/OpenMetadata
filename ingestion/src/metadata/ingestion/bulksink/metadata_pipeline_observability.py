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
BulkSink class used for Pipeline Profiler workflows.

It sends pipeline observability data to table entities,
with merge logic to append new pipeline data or update existing entries.

It picks up the information from reading the files
produced by the stage. At the end, the path is removed.
"""
import json
import os
import shutil
import traceback
from pathlib import Path
from typing import Dict, List, Optional

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.pipelineObservability import PipelineObservability
from metadata.ingestion.api.models import StackTraceError
from metadata.ingestion.api.steps import BulkSink
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import UTF_8
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MetadataPipelineObservabilitySinkConfig(ConfigModel):
    """
    Configuration for Metadata Pipeline Observability Sink
    """
    filename: str


class MetadataPipelineObservabilityBulkSink(BulkSink):
    """
    BulkSink implementation to send pipeline observability data to table entities.
    
    Implements merge logic:
    - Append new pipeline observability data
    - Update existing entries based on pipeline FQN
    """

    config: MetadataPipelineObservabilitySinkConfig

    def __init__(
        self,
        config: MetadataPipelineObservabilitySinkConfig,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.wrote_something = False
        
        # Track processed tables for logging
        self.processed_tables: Dict[str, int] = {}

    @property
    def name(self) -> str:
        return "Pipeline Observability Metadata Sink"

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config = MetadataPipelineObservabilitySinkConfig.model_validate(config_dict)
        return cls(config, metadata)

    def run(self):
        """
        Read staged pipeline observability files and send data to OpenMetadata.
        """
        try:
            staging_dir = Path(self.config.filename)
            logger.info(f"Processing pipeline observability files from {staging_dir}")
            
            if not staging_dir.exists():
                logger.warning(f"Staging directory {staging_dir} does not exist")
                return
            
            # Process all observability JSON files
            observability_files = list(staging_dir.glob("*_observability.json"))
            
            if not observability_files:
                logger.info("No pipeline observability files found to process")
                return
            
            for file_path in observability_files:
                try:
                    self._process_observability_file(file_path)
                except Exception as exc:
                    logger.error(f"Failed to process observability file {file_path}: {exc}")
                    logger.debug(traceback.format_exc())
                    continue
            
            # Log summary
            total_processed = sum(self.processed_tables.values())
            logger.info(
                f"Pipeline observability bulk sink completed. "
                f"Processed {total_processed} observability entries across {len(self.processed_tables)} tables"
            )
            
        except Exception as exc:
            logger.error(f"Failed to run pipeline observability bulk sink: {exc}")
            logger.debug(traceback.format_exc())
        # Note: Do not cleanup staging directory here - let the stage handle cleanup
        # The stage's close() method runs after bulk sink and handles cleanup properly

    def _process_observability_file(self, file_path: Path):
        """
        Process a single observability JSON file.
        
        Args:
            file_path: Path to the observability file
        """
        try:
            with open(file_path, "r", encoding=UTF_8) as file:
                data = json.load(file)
            
            table_fqn = data.get("table_fqn")
            observability_data_json = data.get("observability_data", [])
            
            if not table_fqn or not observability_data_json:
                logger.warning(f"Invalid observability file format: {file_path}")
                return
            
            # Convert JSON back to PipelineObservability objects
            observability_data = [
                PipelineObservability.model_validate(obs_json)
                for obs_json in observability_data_json
            ]
            
            # Get the table entity
            table = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
            if not table:
                logger.warning(f"Table not found: {table_fqn}")
                return
            
            # Send observability data to OpenMetadata with merge logic
            self._add_pipeline_observability(table, observability_data)
            
            # Track processed data
            self.processed_tables[table_fqn] = len(observability_data)
            self.wrote_something = True
            
            # Update status tracking for each observability entry
            for _ in observability_data:
                self.status.scanned(f"Pipeline observability for {table_fqn}")
            
            logger.info(
                f"Successfully processed {len(observability_data)} observability entries for table {table_fqn}"
            )
            
        except Exception as exc:
            logger.error(f"Failed to process observability file {file_path}: {exc}")
            logger.debug(traceback.format_exc())
            self.status.failed(
                StackTraceError(
                    name=f"Observability file {file_path.name}",
                    error=f"Failed to process observability file: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _add_pipeline_observability(self, table: Table, observability_data: List[PipelineObservability]):
        """
        Add pipeline observability data to a table using individual storage calls.
        
        This method uses individual pipeline FQN-based storage to ensure proper
        entity_extension storage mechanism rather than bulk updates.
        
        Args:
            table: Table entity to update
            observability_data: List of new pipeline observability data
        """
        try:
            table_id = table.id
            
            # Use the existing working bulk method from table mixin
            result_table = self.metadata.add_pipeline_observability(
                table_id=table_id,
                pipeline_observability=observability_data
            )
            
            if result_table:
                logger.info(
                    f"Successfully stored {len(observability_data)} pipeline observability entries "
                    f"for table {table.fullyQualifiedName.root}"
                )
            else:
                logger.warning(
                    f"No response received for pipeline observability update for table {table.fullyQualifiedName.root}"
                )
            
        except Exception as exc:
            logger.error(
                f"Failed to store pipeline observability for table {table.fullyQualifiedName.root}: {exc}"
            )
            logger.debug(traceback.format_exc())

    def _cleanup_staging_dir(self):
        """
        Clean up the staging directory after processing.
        """
        try:
            staging_dir = Path(self.config.filename)
            if staging_dir.exists():
                shutil.rmtree(staging_dir)
                logger.info(f"Cleaned up staging directory: {staging_dir}")
        except Exception as exc:
            logger.warning(f"Failed to cleanup staging directory: {exc}")

    def close(self):
        """
        Clean up resources and staging directory.
        """
        if not self.wrote_something:
            logger.info("Pipeline observability bulk sink didn't process any data")
        else:
            logger.info("Pipeline observability bulk sink completed successfully")
        
        # Clean up staging directory
        self._cleanup_staging_dir()