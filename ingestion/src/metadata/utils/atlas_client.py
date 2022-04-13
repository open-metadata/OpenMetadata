import base64
from typing import List

from metadata.generated.schema.entity.services.connections.database.atlasConnection import (
    AtlasConnection,
)
from metadata.ingestion.ometa.client import REST, APIError, ClientConfig


class AtlasClient:
    def __init__(self, config: AtlasConnection, raw_data: bool = False):

        self.config = config
        config_obj = self.config.serviceConnection.__root__.config
        self.auth_token = generate_http_basic_token(
            config_obj.user_name, config_obj.password.get_secret_value()
        )
        client_config: ClientConfig = ClientConfig(
            base_url=config_obj.atlasHost,
            auth_header="Authorization",
            api_version="api",
            auth_token=self.get_auth_token,
            auth_token_mode="Basic",
        )
        self.client = REST(client_config)
        self._use_raw_data = raw_data

    def list_entities(self, entityType="Table") -> List[str]:
        response = self.client.get(f"/atlas/entities?type={entityType}")

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
        return (self.auth_token, 0)


def generate_http_basic_token(username, password):
    """
    Generates a HTTP basic token from username and password
    Returns a token string (not a byte)
    """
    token = base64.b64encode("{}:{}".format(username, password).encode("utf-8")).decode(
        "utf-8"
    )
    return token
