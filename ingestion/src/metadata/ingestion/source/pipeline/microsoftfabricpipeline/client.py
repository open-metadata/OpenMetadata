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
Microsoft Fabric Pipeline Client

Wrapper around the shared FabricClient for pipeline-specific operations.
"""

from typing import List, Optional

from metadata.clients.microsoftfabric.fabric_client import FabricClient
from metadata.clients.microsoftfabric.models import (
    FabricActivity,
    FabricActivityRun,
    FabricPipeline,
    FabricPipelineRun,
)
from metadata.generated.schema.entity.services.connections.pipeline.microsoftFabricPipelineConnection import (
    MicrosoftFabricPipelineConnection,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MicrosoftFabricPipelineClient:
    """
    Client for Microsoft Fabric Pipeline operations.

    Wraps the shared FabricClient and adds pipeline-specific functionality.
    """

    def __init__(self, connection: MicrosoftFabricPipelineConnection):
        self.connection = connection
        self.workspace_id = connection.workspaceId
        self._fabric_client: Optional[FabricClient] = None

    @property
    def fabric_client(self) -> FabricClient:
        """Lazy-initialize the Fabric client"""
        if self._fabric_client is None:
            self._fabric_client = FabricClient(
                tenant_id=self.connection.tenantId,
                client_id=self.connection.clientId,
                client_secret=self.connection.clientSecret.get_secret_value(),
                authority_uri=self.connection.authorityUri or "https://login.microsoftonline.com/",
            )
        return self._fabric_client

    def get_pipelines(self) -> List[FabricPipeline]:
        """Get all pipelines in the configured workspace"""
        return self.fabric_client.get_pipelines(self.workspace_id)

    def get_pipeline(self, pipeline_id: str) -> Optional[FabricPipeline]:
        """Get a specific pipeline by ID"""
        return self.fabric_client.get_pipeline(self.workspace_id, pipeline_id)

    def get_pipeline_runs(self, pipeline_id: str) -> List[FabricPipelineRun]:
        """Get run history for a pipeline"""
        return self.fabric_client.get_pipeline_runs(self.workspace_id, pipeline_id)

    def get_pipeline_activities(self, pipeline_id: str) -> List[FabricActivity]:
        """Get activities (tasks) for a pipeline from its definition"""
        return self.fabric_client.get_pipeline_activities(self.workspace_id, pipeline_id)

    def get_pipeline_url(self, pipeline_id: str) -> str:
        """Generate URL to the pipeline in the Fabric UI"""
        return f"https://app.fabric.microsoft.com/groups/{self.workspace_id}/pipelines/{pipeline_id}"

    def get_pipeline_activity_runs(self, pipeline_run_id: str, run: FabricPipelineRun) -> List[FabricActivityRun]:
        """
        Get activity-level execution details for a pipeline run.

        Args:
            pipeline_run_id: The pipeline run/job instance ID
            run: The FabricPipelineRun object with start/end times

        Returns:
            List of activity runs with detailed execution information
        """
        return self.fabric_client.get_pipeline_activity_runs(self.workspace_id, pipeline_run_id, run)
