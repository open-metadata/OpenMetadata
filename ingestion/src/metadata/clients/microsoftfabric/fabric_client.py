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
Microsoft Fabric REST API Client

Provides a unified REST client for Fabric APIs:
- Fabric REST API (https://api.fabric.microsoft.com/v1)
"""
import base64
import json
import traceback
from typing import Any, Dict, List, Optional

from metadata.clients.microsoftfabric.fabric_auth import (
    FABRIC_API_SCOPE,
    FabricAuthenticator,
)
from metadata.clients.microsoftfabric.models import (
    FabricActivity,
    FabricActivityRun,
    FabricItem,
    FabricPipeline,
    FabricPipelineRun,
    FabricWorkspace,
)
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

FABRIC_API_BASE_URL = "https://api.fabric.microsoft.com"


class FabricClient:
    """
    REST client for Microsoft Fabric APIs.

    Handles workspace, warehouse, lakehouse, and pipeline operations.
    """

    def __init__(
        self,
        tenant_id: str,
        client_id: str,
        client_secret: str,
        authority_uri: str = "https://login.microsoftonline.com/",
    ):
        self.authenticator = FabricAuthenticator(
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret,
            authority_uri=authority_uri,
        )
        self._client: Optional[REST] = None

    @property
    def client(self) -> REST:
        """Lazy-initialize REST client"""
        if self._client is None:
            client_config = ClientConfig(
                base_url=FABRIC_API_BASE_URL,
                api_version="v1",
                auth_token=self.authenticator.get_token_callback(FABRIC_API_SCOPE),
                auth_header="Authorization",
                allow_redirects=True,
                retry_codes=[429],
                retry=100,
                retry_wait=30,
            )
            self._client = REST(client_config)
        return self._client

    # ===== Workspace APIs =====

    def get_workspaces(self) -> List[FabricWorkspace]:
        """List all workspaces accessible to the service principal"""
        try:
            response = self.client.get("/workspaces")
            workspaces = []
            for item in response.get("value", []):
                try:
                    workspaces.append(FabricWorkspace.model_validate(item))
                except Exception as exc:
                    logger.warning(f"Error parsing workspace: {exc}")
            return workspaces
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching workspaces: {exc}")
            return []

    def get_workspace(self, workspace_id: str) -> Optional[FabricWorkspace]:
        """Get details of a specific workspace"""
        try:
            response = self.client.get(f"/workspaces/{workspace_id}")
            return FabricWorkspace.model_validate(response)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching workspace {workspace_id}: {exc}")
            return None

    # ===== Item APIs =====

    def get_workspace_items(
        self, workspace_id: str, item_type: Optional[str] = None
    ) -> List[FabricItem]:
        """
        List items in a workspace.

        Args:
            workspace_id: The workspace ID
            item_type: Optional filter (Warehouse, Lakehouse, DataPipeline, etc.)
        """
        try:
            params = {}
            if item_type:
                params["type"] = item_type
            response = self.client.get(f"/workspaces/{workspace_id}/items", data=params)
            items = []
            for item in response.get("value", []):
                try:
                    items.append(FabricItem.model_validate(item))
                except Exception as exc:
                    logger.warning(f"Error parsing item: {exc}")
            return items
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching workspace items: {exc}")
            return []

    # ===== Database-specific APIs =====

    def get_warehouses(self, workspace_id: str) -> List[FabricItem]:
        """List Warehouses in a workspace"""
        return self.get_workspace_items(workspace_id, "Warehouse")

    def get_lakehouses(self, workspace_id: str) -> List[FabricItem]:
        """List Lakehouses in a workspace"""
        return self.get_workspace_items(workspace_id, "Lakehouse")

    def get_warehouse_details(
        self, workspace_id: str, warehouse_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific warehouse"""
        try:
            response = self.client.get(
                f"/workspaces/{workspace_id}/warehouses/{warehouse_id}"
            )
            return response
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching warehouse details: {exc}")
            return None

    def get_lakehouse_details(
        self, workspace_id: str, lakehouse_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific lakehouse"""
        try:
            response = self.client.get(
                f"/workspaces/{workspace_id}/lakehouses/{lakehouse_id}"
            )
            return response
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching lakehouse details: {exc}")
            return None

    # ===== Pipeline APIs =====

    def get_pipelines(self, workspace_id: str) -> List[FabricPipeline]:
        """List Data Pipelines in a workspace"""
        try:
            # Fabric API uses /items endpoint with type filter
            response = self.client.get(
                f"/workspaces/{workspace_id}/items", data={"type": "DataPipeline"}
            )
            pipelines = []
            for item in response.get("value", []):
                try:
                    pipelines.append(FabricPipeline.model_validate(item))
                except Exception as exc:
                    logger.warning(f"Error parsing pipeline: {exc}")
            return pipelines
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching pipelines: {exc}")
            return []

    def get_pipeline(
        self, workspace_id: str, pipeline_id: str
    ) -> Optional[FabricPipeline]:
        """Get a specific pipeline"""
        try:
            # Fabric API uses /items/{itemId} endpoint
            response = self.client.get(
                f"/workspaces/{workspace_id}/items/{pipeline_id}"
            )
            return FabricPipeline.model_validate(response)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching pipeline {pipeline_id}: {exc}")
            return None

    def get_pipeline_runs(
        self, workspace_id: str, pipeline_id: str
    ) -> List[FabricPipelineRun]:
        """Get pipeline run history"""
        try:
            # Note: Fabric API might use /items/{itemId}/jobs/instances for runs
            # Keeping the old endpoint for now, may need adjustment based on API docs
            response = self.client.get(
                f"/workspaces/{workspace_id}/items/{pipeline_id}/jobs/instances"
            )
            runs = []
            for item in response.get("value", []):
                try:
                    runs.append(FabricPipelineRun.model_validate(item))
                except Exception as exc:
                    logger.warning(f"Error parsing pipeline run: {exc}")
            return runs
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching pipeline runs: {exc}")
            return []

    def get_pipeline_activities(  # pylint: disable=too-many-nested-blocks
        self, workspace_id: str, pipeline_id: str
    ) -> List[FabricActivity]:
        """
        Get pipeline activities (tasks) from the pipeline definition.

        The pipeline definition contains the activities that make up the pipeline.
        """
        try:
            # Fabric API uses /items/{itemId}/getDefinition endpoint
            response = self.client.post(
                f"/workspaces/{workspace_id}/items/{pipeline_id}/getDefinition"
            )
            activities = []
            # The definition contains a "definition" object with "parts" array
            # Each part may contain the pipeline JSON with activities
            definition = response.get("definition", {})
            parts = definition.get("parts", [])
            for part in parts:
                if part.get("path") == "pipeline-content.json":
                    # The payload contains the actual pipeline definition
                    payload = part.get("payload", "")
                    if payload:
                        try:
                            pipeline_content = json.loads(base64.b64decode(payload))
                            for activity_data in pipeline_content.get(
                                "properties", {}
                            ).get("activities", []):
                                try:
                                    activities.append(
                                        FabricActivity.model_validate(activity_data)
                                    )
                                except Exception as exc:
                                    logger.warning(f"Error parsing activity: {exc}")
                        except Exception as exc:
                            logger.warning(f"Error decoding pipeline content: {exc}")
            return activities
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching pipeline activities: {exc}")
            return []

    def get_pipeline_activity_runs(  # pylint: disable=import-outside-toplevel
        self, workspace_id: str, pipeline_run_id: str, run: FabricPipelineRun
    ) -> List[FabricActivityRun]:
        """
        Get activity-level execution details for a pipeline run.

        This uses the queryactivityruns API to fetch actual execution details
        for each activity/task in a pipeline run, including precise timing,
        status, input/output, and error information.

        Args:
            workspace_id: The workspace ID
            pipeline_run_id: The pipeline run/job instance ID
            run: The FabricPipelineRun object containing start/end times

        Returns:
            List of FabricActivityRun objects with detailed execution information
        """
        try:
            from datetime import timedelta

            # Use the run's start/end time to define the query range
            # Add buffer to ensure we capture all activity runs
            if run.start_time and run.end_time:
                last_updated_after = (run.start_time - timedelta(hours=1)).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                )
                last_updated_before = (run.end_time + timedelta(hours=1)).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                )
            else:
                from datetime import datetime, timezone

                now = datetime.now(timezone.utc)
                last_updated_after = (now - timedelta(days=7)).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                )
                last_updated_before = now.strftime("%Y-%m-%dT%H:%M:%SZ")

            request_body = {
                "filters": [],  # No filters - get all activities
                "orderBy": [{"orderBy": "ActivityRunStart", "order": "ASC"}],
                "lastUpdatedAfter": last_updated_after,
                "lastUpdatedBefore": last_updated_before,
            }

            response = self.client.post(
                f"/workspaces/{workspace_id}/datapipelines/pipelineruns/{pipeline_run_id}/queryactivityruns",
                json=request_body,
            )

            activity_runs = []
            for item in response.get("value", []):
                try:
                    activity_runs.append(FabricActivityRun.model_validate(item))
                except Exception as exc:
                    logger.warning(f"Error parsing activity run: {exc}")
            return activity_runs
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching activity runs for {pipeline_run_id}: {exc}")
            return []
