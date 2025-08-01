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
Client to interact with fivetran apis
"""
import base64
from typing import List, Optional

from requests import Response

from metadata.generated.schema.entity.services.connections.pipeline.fivetranConnection import (
    FivetranConnection,
)
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.utils.helpers import clean_uri


class FivetranClient:
    """
    Client to interact with fivetran apis
    """

    def __init__(self, config: FivetranConnection):
        self.config = config
        api_token = str(
            base64.b64encode(
                f"{config.apiKey}:{config.apiSecret.get_secret_value()}".encode("ascii")
            )
        )

        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(str(self.config.hostPort)),
            api_version="v1",
            auth_header="Authorization",
            auth_token=lambda: (api_token[2:-1], 0),
            auth_token_mode="Basic",
        )
        self.client = REST(client_config)

    def run_paginator(self, path: str) -> List[dict]:
        response = self.client.get(f"{path}?limit={self.config.limit}")
        data = response.get("data")
        result = data.get("items")
        while data.get("next_cursor"):
            response = self.client.get(
                f"{path}?limit={self.config.limit}&cursor={data['next_cursor']}"
            )
            data = response["data"]
            result.extend(data["items"])
        return result

    def list_groups(self) -> List[dict]:
        """
        Method returns the list of all groups
        """
        return self.run_paginator("/groups")

    def list_group_connectors(self, group_id: str) -> List[dict]:
        """
        Method returns the list all of connectors of group
        """
        return self.run_paginator(f"/groups/{group_id}/connectors")

    def get_connector_details(self, connector_id: str) -> dict:
        """
        Method returns connector details
        """
        response = self.client.get(f"/connectors/{connector_id}")
        return response.get("data")

    def get_destination_details(self, destination_id: str) -> dict:
        """
        Method returns destination details
        """
        response = self.client.get(f"/destinations/{destination_id}")
        return response.get("data")

    def get_connector_schema_details(self, connector_id: str) -> dict:
        """
        Method returns destination details
        """
        response = self.client.get(f"/connectors/{connector_id}/schemas")
        return response.get("data", {}).get("schemas", [])

    def get_connector_column_lineage(
        self, connector_id: str, schema_name: str, table_name: str
    ) -> dict:
        """
        Method returns destination details
        """
        response: Optional[Response] = self.client.get(
            f"/connectors/{connector_id}/schemas/{schema_name}/tables/{table_name}/columns"
        )
        return response.get("data", {}).get("columns", [])
