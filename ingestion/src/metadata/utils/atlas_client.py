import base64
import json
from typing import List

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.ingestion.api.common import IncludeFilterPattern
from metadata.ingestion.ometa.client import REST, APIError, ClientConfig


class AtlasSourceConfig(ConfigModel):
    atlas_host: str = "http://localhost:21000"
    user_name: str
    password: str
    service_name: str
    service_type: str = "Hive"
    host_port: str
    filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()

    def get_service_type(self) -> DatabaseServiceType:
        return DatabaseServiceType[self.service_type]

    def get_service_name(self) -> str:
        return self.service_name


class AtlasClient:
    def __init__(self, config: AtlasSourceConfig, raw_data: bool = False):
        self.config = config
        self.auth_token = generate_http_basic_token(config.user_name, config.password)
        client_config: ClientConfig = ClientConfig(
            base_url=self.config.atlas_host,
            auth_header="Authorization",
            api_version="api",
            auth_token="Basic {}".format(self.auth_token),
        )
        self.client = REST(client_config)
        self._use_raw_data = raw_data

    def list_entities(self, entity_type="Table") -> List[str]:
        response = self.client.get(f"/atlas/entities?type={entity_type}")

        if "error" in response.keys():
            raise APIError(response["error"])
        entities = response["results"]
        return entities

    def get_table(self, table):
        response = self.client.get(f"/atlas/v2/entity/bulk?guid={table}")
        return response


def generate_http_basic_token(username, password):
    """
    Generates a HTTP basic token from username and password
    Returns a token string (not a byte)
    """
    token = base64.b64encode("{}:{}".format(username, password).encode("utf-8")).decode(
        "utf-8"
    )
    return token
