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
Mixin class for sending progress updates and operation metrics to OpenMetadata server.
"""
from typing import Optional

from metadata.generated.schema.entity.services.ingestionPipelines.operationMetrics import (
    OperationMetricsBatch,
)
from metadata.generated.schema.entity.services.ingestionPipelines.progressUpdate import (
    ProgressUpdate,
)
from metadata.ingestion.ometa.client import REST
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaProgressMixin:
    """
    Mixin for OpenMetadata API client to send progress updates and operation metrics.

    This mixin extends the OpenMetadata client with methods to:
    - Send real-time progress updates during ingestion
    - Submit batches of operation metrics (db queries, API calls, etc.)
    """

    client: REST

    def send_progress_update(
        self, pipeline_fqn: str, run_id: str, update: ProgressUpdate
    ) -> None:
        """
        Send a progress update to the OpenMetadata server.

        Args:
            pipeline_fqn: Fully qualified name of the ingestion pipeline
            run_id: UUID of the current pipeline run
            update: ProgressUpdate object with current progress state
        """
        try:
            encoded_fqn = pipeline_fqn.replace("/", "%2F")
            self.client.put(
                f"/services/ingestionPipelines/progress/{encoded_fqn}/{run_id}",
                update.model_dump(mode="json", exclude_none=True),
            )
        except Exception as exc:
            logger.debug(f"Failed to send progress update: {exc}")

    def send_operation_metrics_batch(
        self, pipeline_fqn: str, run_id: str, batch: OperationMetricsBatch
    ) -> None:
        """
        Send a batch of operation metrics to the OpenMetadata server.

        Args:
            pipeline_fqn: Fully qualified name of the ingestion pipeline
            run_id: UUID of the current pipeline run
            batch: OperationMetricsBatch containing collected metrics
        """
        try:
            encoded_fqn = pipeline_fqn.replace("/", "%2F")
            self.client.post(
                f"/services/ingestionPipelines/metrics/{encoded_fqn}/{run_id}",
                batch.model_dump(mode="json", exclude_none=True),
            )
        except Exception as exc:
            logger.debug(f"Failed to send operation metrics batch: {exc}")

    def get_progress_state(
        self, pipeline_fqn: str, run_id: str
    ) -> Optional[ProgressUpdate]:
        """
        Get the current progress state for a pipeline run.

        Args:
            pipeline_fqn: Fully qualified name of the ingestion pipeline
            run_id: UUID of the current pipeline run

        Returns:
            ProgressUpdate object if available, None otherwise
        """
        try:
            encoded_fqn = pipeline_fqn.replace("/", "%2F")
            response = self.client._request(
                "GET",
                f"/services/ingestionPipelines/progress/{encoded_fqn}/{run_id}",
            )
            if response:
                return ProgressUpdate.model_validate(response)
            return None
        except Exception as exc:
            logger.debug(f"Failed to get progress state: {exc}")
            return None
