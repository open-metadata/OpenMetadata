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
Mixin class containing ingestion pipeline specific methods

To be used by OpenMetadata class
"""

from typing import Dict, List, Optional

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
    PipelineStatus,
)
from metadata.ingestion.api.parser import parse_ingestion_pipeline_config_gracefully
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import quote
from metadata.utils.logger import ometa_logger

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
            f"{self.get_suffix(IngestionPipeline)}/{quote(ingestion_pipeline_fqn)}/pipelineStatus",
            data=pipeline_status.model_dump_json(),
        )
        logger.debug(
            f"Created Pipeline Status for pipeline {ingestion_pipeline_fqn}: {pipeline_status}"
        )
        return resp

    def get_pipeline_status(
        self, ingestion_pipeline_fqn: str, pipeline_status_run_id: str
    ) -> Optional[PipelineStatus]:
        """
        GET pipeline status

        :param ingestion_pipeline_fqn: Ingestion Pipeline FQN
        :param pipeline_status_run_id: Pipeline Status run id
        """
        resp = self.client.get(
            f"{self.get_suffix(IngestionPipeline)}/"
            f"{quote(ingestion_pipeline_fqn)}/pipelineStatus/{pipeline_status_run_id}"
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
            f"{self.get_suffix(IngestionPipeline)}/trigger/{ingestion_pipeline_id}"
        )

        return parse_ingestion_pipeline_config_gracefully(resp)

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
            f"{self.get_suffix(IngestionPipeline)}/{quote(ingestion_pipeline_fqn)}/pipelineStatus",
            data=params,
        )

        if resp:
            return [
                PipelineStatus.model_validate(status) for status in resp.get("data")
            ]
        return None

    def get_ingestion_pipeline_by_name(
        self,
        fields: Optional[List[str]] = None,
        params: Optional[Dict[str, str]] = None,
    ) -> Optional[IngestionPipeline]:
        """
        Get ingestion pipeline statues based on name

        Args:
            name (str): Ingestion Pipeline Name
            fields (List[str]): List of all the fields
        """
        fields_str = "?fields=" + ",".join(fields) if fields else ""
        resp = self.client.get(
            f"{self.get_suffix(IngestionPipeline)}{fields_str}",
            data=params,
        )

        if hasattr(resp, "sourceConfig"):
            return parse_ingestion_pipeline_config_gracefully(resp)

        return None
