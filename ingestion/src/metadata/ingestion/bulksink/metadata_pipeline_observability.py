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
from metadata.ingestion.api.steps import BulkSink
from metadata.ingestion.ometa.client import APIError
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
            staging_dir = Path(self.config.filename).parent
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
        finally:
            # Cleanup staging directory
            self._cleanup_staging_dir()

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
            
            logger.info(
                f"Successfully processed {len(observability_data)} observability entries for table {table_fqn}"
            )
            
        except Exception as exc:
            logger.error(f"Failed to process observability file {file_path}: {exc}")
            logger.debug(traceback.format_exc())

    def _add_pipeline_observability(self, table: Table, observability_data: List[PipelineObservability]):
        """
        Add pipeline observability data to a table with merge logic.
        
        Args:
            table: Table entity to update
            observability_data: List of new pipeline observability data
        """
        try:
            # Get existing observability data
            existing_obs = table.pipelineObservability or []
            
            # Create a map of existing data by pipeline FQN for efficient lookup
            existing_obs_map = {}
            for obs in existing_obs:
                if obs.pipeline and obs.pipeline.fullyQualifiedName:
                    pipeline_fqn = obs.pipeline.fullyQualifiedName.__root__
                    existing_obs_map[pipeline_fqn] = obs
            
            # Merge new data with existing data
            merged_obs_list = []
            
            # Add existing data (will be updated if new data has same pipeline)
            for pipeline_fqn, obs in existing_obs_map.items():
                merged_obs_list.append(obs)
            
            # Process new observability data
            for new_obs in observability_data:
                if new_obs.pipeline and new_obs.pipeline.fullyQualifiedName:
                    pipeline_fqn = new_obs.pipeline.fullyQualifiedName.__root__
                    
                    if pipeline_fqn in existing_obs_map:
                        # Update existing entry
                        for i, obs in enumerate(merged_obs_list):
                            if (obs.pipeline and obs.pipeline.fullyQualifiedName and 
                                obs.pipeline.fullyQualifiedName.__root__ == pipeline_fqn):
                                merged_obs_list[i] = new_obs  # Replace with new data
                                logger.debug(f"Updated existing observability data for pipeline {pipeline_fqn}")
                                break
                    else:
                        # Append new entry
                        merged_obs_list.append(new_obs)
                        logger.debug(f"Added new observability data for pipeline {pipeline_fqn}")
                else:
                    # If no pipeline reference, just append
                    merged_obs_list.append(new_obs)
            
            # Update the table entity with merged observability data using REST API
            table_id = table.id.__root__
            
            # Call the REST API to update pipeline observability
            try:
                # Convert observability data to JSON format
                observability_json = [obs.model_dump() for obs in merged_obs_list]
                
                response = self.metadata.client.put(
                    f"/tables/{table_id}/pipelineObservability",
                    data=observability_json
                )
                
                logger.info(
                    f"Successfully updated table {table.fullyQualifiedName.__root__} with "
                    f"{len(merged_obs_list)} pipeline observability entries"
                )
                
            except Exception as api_exc:
                logger.error(
                    f"Failed to call REST API for table {table.fullyQualifiedName.__root__}: {api_exc}"
                )
                raise api_exc
            
        except APIError as api_err:
            logger.error(
                f"Failed to update pipeline observability for table {table.fullyQualifiedName.__root__}: {api_err}"
            )
        except Exception as exc:
            logger.error(
                f"Unexpected error updating pipeline observability for table {table.fullyQualifiedName.__root__}: {exc}"
            )
            logger.debug(traceback.format_exc())

    def _cleanup_staging_dir(self):
        """
        Clean up the staging directory after processing.
        """
        try:
            staging_dir = Path(self.config.filename).parent
            if staging_dir.exists():
                shutil.rmtree(staging_dir)
                logger.info(f"Cleaned up staging directory: {staging_dir}")
        except Exception as exc:
            logger.warning(f"Failed to cleanup staging directory: {exc}")

    def close(self):
        """
        Clean up resources.
        """
        if not self.wrote_something:
            logger.info("Pipeline observability bulk sink didn't process any data")
        else:
            logger.info("Pipeline observability bulk sink completed successfully")