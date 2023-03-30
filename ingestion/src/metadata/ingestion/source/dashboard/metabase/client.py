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
REST Auth & Client for Metabase
"""
from typing import List, Optional
import traceback
import requests
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

class MetabaseClient(DashboardServiceSource):
    
    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection
    ):
        try:
          super().__init__(config, metadata_config)
          self.metabase_session = self.client["metabase_session"]
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Error in initializing Metabase Client: {exc}")
    
    def req_get(self, path: str) -> requests.Response:
      """Send get request method

      Args:
          path:
      """
      return requests.get(
          self.service_connection.hostPort + path,
          headers=self.metabase_session,
          timeout=30,
      )
    
    def get_dashboards_list(self) -> Optional[List[dict]]:
        """
        Get List of all dashboards
        """
        resp_dashboards = self.req_get("/api/dashboard")
        if resp_dashboards.status_code == 200:
            return resp_dashboards.json()
        return []
    
    def get_dashboard_name(self, dashboard: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard["name"]

    def get_dashboard_details(self, dashboard: dict) -> dict:
        """
        Get Dashboard Details
        """
        resp_dashboard = self.req_get(f"/api/dashboard/{dashboard['id']}")
        return resp_dashboard.json()
    
    def get_database(self, database_id: str) -> dict:
        """
        Get Database using database ID
        """
        resp_database = self.req_get(f"/api/database/{database_id}")
        return resp_database.json()
    
    def get_table(self, table_id: str) -> dict:
        """
        Get Table using table ID
        """
        resp_table = self.req_get(f"/api/table/{table_id}")
        return resp_table.json()