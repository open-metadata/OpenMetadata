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
Incremental Metadata Extraction related classes
"""
import traceback
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from pydantic import BaseModel

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
    PipelineStatus,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    Incremental,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

MILLISECONDS_IN_ONE_DAY = 24 * 60 * 60 * 1000


class IncrementalConfig(BaseModel):
    """Holds the Configuration to extract the Metadata incrementally, if enabled."""

    enabled: bool
    start_timestamp: Optional[int] = None

    @property
    def start_datetime_utc(self) -> Optional[datetime]:
        if self.start_timestamp:
            return datetime.fromtimestamp(self.start_timestamp / 1000, timezone.utc)
        return None

    @classmethod
    def create(
        cls,
        incremental: Optional[bool],
        pipeline_name: Optional[str],
        metadata: OpenMetadata,
    ) -> "IncrementalConfig":
        """Returns the IncrementalConfig based on the flow defined on the IncrementalConfigCreator."""
        return IncrementalConfigCreator(incremental, pipeline_name, metadata).create()


class IncrementalConfigCreator:
    """Helper class to create an IncrementalConfig instance automagically."""

    def __init__(
        self,
        incremental: Optional[Incremental],
        pipeline_name: Optional[str],
        metadata: OpenMetadata,
    ):
        self.incremental = incremental
        self.pipeline_name = pipeline_name
        self.metadata = metadata

    def _calculate_pipeline_status_parameters(self) -> Tuple[int, int]:
        """Calculate the needed 'start' and 'end' parameters based on the 'lookbackDays'."""
        now = datetime.now()

        # We multiply the value by 1000 because our backend uses epoch_milliseconds instead of epoch_seconds.
        start = int(
            (now - timedelta(days=self.incremental.lookbackDays)).timestamp() * 1000
        )
        end = int(now.timestamp() * 1000)

        return start, end

    def _get_pipeline_statuses(self) -> Optional[List[PipelineStatus]]:
        """Retrieve all the pipeline statuses between 'start' and 'end'."""
        if not self.pipeline_name:
            return None

        start, end = self._calculate_pipeline_status_parameters()

        return self.metadata.get_pipeline_status_between_ts(
            self.pipeline_name, start, end
        )

    def _get_last_success_timestamp(
        self, pipeline_statuses: List[PipelineStatus]
    ) -> Optional[int]:
        """Filter the pipeline statuses to get the last time the pipeline was run succesfully."""
        return max(  # pylint: disable=R1728
            [
                pipeline.startDate.root
                for pipeline in pipeline_statuses
                if pipeline.pipelineState == PipelineState.success
                and pipeline.startDate
            ]
        )

    def _add_safety_margin(self, last_success_timestamp: int) -> int:
        """Add some safety margin to the last successful run timestamp based on the 'safetyMarginDays'."""
        return last_success_timestamp - (
            self.incremental.safetyMarginDays * MILLISECONDS_IN_ONE_DAY
        )

    def create(self) -> IncrementalConfig:
        """Creates a new IncrementalConfig using the historical runs of the pipeline.
        If no previous successful runs are found within the time period it will disable the incremental ingestion.
        """
        try:
            if (
                not (self.incremental and self.pipeline_name)
                or not self.incremental.enabled
            ):
                return IncrementalConfig(enabled=False)

            pipeline_statuses = self._get_pipeline_statuses()

            if not pipeline_statuses:
                return IncrementalConfig(enabled=False)

            last_success_timestamp = self._get_last_success_timestamp(pipeline_statuses)

            if not last_success_timestamp:
                return IncrementalConfig(enabled=False)

            return IncrementalConfig(
                enabled=True,
                start_timestamp=self._add_safety_margin(last_success_timestamp),
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.info(
                "Couldn't create the IncrementalConfig due to %s. Proceeding Full Extraction.",
                exc,
            )
            return IncrementalConfig(enabled=False)
