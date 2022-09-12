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
Client to interact with databricks apis
"""
from typing import List

from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.ingestion.ometa.client import REST, APIError, ClientConfig


class DatabricksClient:
    def __init__(self, config: DatabricksConnection):
        self.config = config
        client_config: ClientConfig = ClientConfig(
            base_url=self.config.hostPort,
            api_version="api/v1",
            auth_header="Authorization",
            auth_token_mode="Bearer",
            auth_token=self.config.token,
        )
        self.client = REST(client_config)

    def list_query_history(self) -> List[dict]:
        """
        Method returns List the history of queries through SQL warehouses
        """
        response = self.client.get(f"/api/2.0/sql/history/queries")
