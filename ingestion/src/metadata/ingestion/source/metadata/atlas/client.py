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
Client to interact with Atlas apis
"""
import base64
from typing import List

from metadata.generated.schema.entity.services.connections.metadata.atlasConnection import (
    AtlasConnection,
)
from metadata.ingestion.ometa.client import REST, APIError, ClientConfig
from metadata.utils.helpers import clean_uri


class AtlasClient:
    """
    Client to interact with Atlas apis
    """

    def __init__(self, config: AtlasConnection, raw_data: bool = False):
        self.config = config
        self.auth_token = generate_http_basic_token(
            config.username, config.password.get_secret_value()
        )
        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(config.hostPort),
            auth_header="Authorization",
            api_version="api",
            auth_token=self.get_auth_token,
            auth_token_mode="Basic",
        )
        self.client = REST(client_config)
        self._use_raw_data = raw_data

    def list_entities(self) -> List[str]:
        response = self.client.get(f"/atlas/entities?type={self.config.entity_type}")

        if "error" in response.keys():
            raise APIError(response["error"])
        entities = response["results"]
        return entities

    def get_entity(self, table):
        response = self.client.get(f"/atlas/v2/entity/bulk?guid={table}")
        return response

    def get_lineage(self, source_guid):
        response = self.client.get(f"/atlas/v2/lineage/{source_guid}")
        if "error" in response.keys():
            raise APIError(response["error"])

        return response

    def get_auth_token(self):
        return self.auth_token, 0


def generate_http_basic_token(username, password):
    """
    Generates a HTTP basic token from username and password
    Returns a token string (not a byte)
    """
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("utf-8")
    return token
