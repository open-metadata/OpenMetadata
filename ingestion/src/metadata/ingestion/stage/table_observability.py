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
Table Observability Stage

Stages pipeline observability data by table FQN
for bulk processing by the metadata sink.
"""
import json
import os
import traceback
from typing import Dict, Iterable, List, Optional

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.type.pipelineObservability import PipelineObservability
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Stage
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.pipeline_profiler_source import (
    TablePipelineObservability,
)
from metadata.utils.constants import UTF_8
from metadata.utils.helpers import init_staging_dir
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class TableObservabilityStageConfig(ConfigModel):
    """
    Configuration for Table Observability Stage
    """

    filename: str


class TableObservabilityStage(Stage):
    """
    Stage implementation for Table Pipeline Observability data.

    Stages observability data by table FQN in JSON files
    for bulk processing by the metadata sink.
    """

    config: TableObservabilityStageConfig

    def __init__(
        self,
        config: TableObservabilityStageConfig,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        init_staging_dir(self.config.filename)

        # In-memory storage for observability data grouped by table FQN
        self.observability_data: Dict[str, List[PipelineObservability]] = {}

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> "TableObservabilityStage":
        config = TableObservabilityStageConfig.model_validate(config_dict)
        return cls(config, metadata)

    def _run(self, record: TablePipelineObservability) -> Iterable[Either[str]]:
        """
        Stage pipeline observability data by table FQN.

        Args:
            record: TablePipelineObservability from processor

        Returns:
            Either success (table_fqn) or error message
        """

        try:
            if not record.table or not record.observability_data:
                logger.debug(
                    f"Invalid record - table: {record.table}, observability_data: {record.observability_data}"
                )
                return Either(left="Invalid pipeline observability record")

            table_fqn = record.table.fullyQualifiedName.root
            logger.debug(
                f"Processing table FQN: {table_fqn} with {len(record.observability_data)} observability entries"
            )

            # Group observability data by table FQN
            if table_fqn not in self.observability_data:
                self.observability_data[table_fqn] = []

            # Add new observability data for this table
            self.observability_data[table_fqn].extend(record.observability_data)

            logger.debug(
                f"Staged {len(record.observability_data)} observability entries for table {table_fqn}"
            )

            yield Either(right=table_fqn)
            self.dump_data_to_file()

        except Exception as exc:
            logger.error(f"Failed to stage pipeline observability record: {exc}")
            logger.debug(traceback.format_exc())
            yield Either(
                left=StackTraceError(
                    name="pipeline observability",
                    error=f"Error in staging record [{exc}]",
                    stackTrace=traceback.format_exc(),
                )
            )

    def dump_data_to_file(self):
        """
        Write all staged observability data to files.
        """
        logger.debug(
            f"Staging observability data for {len(self.observability_data)} tables"
        )

        try:
            if not self.observability_data:
                logger.info("No pipeline observability data to stage")
                return

            # Write observability data grouped by table FQN
            for table_fqn, obs_data_list in self.observability_data.items():
                filename = f"{table_fqn.replace('.', '_')}_observability.json"
                file_path = os.path.join(self.config.filename, filename)

                # Convert to JSON-serializable format
                observability_json = [
                    obs_data.model_dump(mode="json") for obs_data in obs_data_list
                ]

                with open(file_path, "w", encoding=UTF_8) as file:
                    json.dump(
                        {
                            "table_fqn": table_fqn,
                            "observability_data": observability_json,
                        },
                        file,
                        indent=2,
                    )

                logger.info(
                    f"Staged {len(obs_data_list)} observability entries for table {table_fqn} "
                    f"to {file_path}"
                )

            logger.info(
                f"Successfully staged pipeline observability data for {len(self.observability_data)} tables "
                f"in {self.config.filename}"
            )

        except Exception as exc:
            logger.error(f"Failed to write staged pipeline observability data: {exc}")
            logger.debug(traceback.format_exc())

    @property
    def name(self) -> str:
        return "Table Observability Stage"

    def get_staging_dir(self) -> str:
        """
        Get the staging directory path
        """
        return str(self.config.filename)

    def close(self) -> None:
        """
        Nothing to close. Data is being dumped inside a context manager
        """
