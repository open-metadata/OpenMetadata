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
Mixin class containing ingestion pipeline specific methods

To be used by OpenMetadata class
"""

from typing import List, Optional

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
    PipelineStatus,
)
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import ometa_logger

logger = ometa_logger()


class OMetaIngestionPipelineMixin:
    """
    OpenMetadata API methods related to ingestion pipeline.

    To be inherited by OpenMetadata
    """

    client: REST

    def create_or_update_pipeline_status(
        self, ingestion_pipeline_fqn: str, pipeline_status: PipelineStatus
    ) -> None:
        """
        PUT create or update pipeline status

        :param ingestion_pipeline_fqn: Ingestion Pipeline FQN
        :param pipeline_status: Pipeline Status data to add
        """
        resp = self.client.put(
            f"/services/ingestionPipelines/{ingestion_pipeline_fqn}/pipelineStatus",
            data=pipeline_status.json(),
        )
        logger.debug(
            f"Created Pipeline Status for pipeline {ingestion_pipeline_fqn}: {resp}"
        )
        return resp

    def get_pipeline_status(
        self, ingestion_pipeline_fqn: str, pipeline_status_run_id: str
    ) -> None:
        """
        GET pipeline status

        :param ingestion_pipeline_fqn: Ingestion Pipeline FQN
        :param pipeline_status_run_id: Pipeline Status run id
        """
        resp = self.client.get(
            f"/services/ingestionPipelines/{ingestion_pipeline_fqn}/pipelineStatus/{pipeline_status_run_id}"
        )
        if resp:
            return PipelineStatus(**resp)
        return None

    def run_pipeline(self, ingestion_pipeline_id: str) -> IngestionPipeline:
        """Run ingestion pipeline workflow

        Args:
            ingestion_pipeline_id (str): ingestion pipeline uuid
        """
        resp = self.client.post(
            f"/services/ingestionPipelines/trigger/{ingestion_pipeline_id}"
        )

        return IngestionPipeline.parse_obj(resp)

    def get_pipeline_status_between_ts(
        self,
        ingestion_pipeline_fqn: str,
        start_ts: int,
        end_ts: int,
    ) -> Optional[List[PipelineStatus]]:
        """Get pipeline status between timestamp

        Args:
            ingestion_pipeline_fqn (str): pipeline fqn
            start_ts (int): start_ts
            end_ts (int): end_ts
        """

        params = {"startTs": start_ts, "endTs": end_ts}

        resp = self.client.get(
            f"/services/ingestionPipelines/{ingestion_pipeline_fqn}/pipelineStatus",
            data=params,
        )

        if resp:
            return [PipelineStatus.parse_obj(status) for status in resp.get("data")]
        return None
