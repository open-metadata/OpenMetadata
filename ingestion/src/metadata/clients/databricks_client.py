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
import traceback
from typing import List

from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DatabricksClient:
    """
    DatabricksClient creates a Databricks connection based on DatabricksCredentials.
    """

    def __init__(self, config: DatabricksConnection):
        self.config = config
        base_url, _ = self.config.hostPort.split(":")

        client_config: ClientConfig = ClientConfig(
            base_url="https://" + base_url,
            api_version="api/2.0",
            auth_header="Authorization",
            auth_token_mode="Bearer",
            auth_token=lambda: (self.config.token.get_secret_value(), 0),
        )
        self.client = REST(client_config)

    def list_query_history(self) -> List[dict]:
        """
        Method returns List the history of queries through SQL warehouses
        """
        query_details = []
        try:
            next_page_token = None
            has_next_page = None

            while True:
                data = {}
                if next_page_token:
                    data["page_token"] = next_page_token
                response = self.client.get("/sql/history/queries", data=data)
                query_details.extend(list(response.get("res")))
                next_page_token = response.get("next_page_token", None)
                has_next_page = response.get("has_next_page", None)
                if not has_next_page:
                    break

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(exc)

        return query_details
