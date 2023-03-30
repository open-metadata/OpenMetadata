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
import requests
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)

class MetabaseClient(DashboardServiceSource):
    
    def __init__(
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection
    ):
        super().__init__(config, metadata_config)
        self.metabase_session = self.client["metabase_session"]
    
    def req_get(self, path):
      """Send get request method

      Args:
          path:
      """
      return requests.get(
          self.service_connection.hostPort + path,
          headers=self.metabase_session,
          timeout=30,
      )