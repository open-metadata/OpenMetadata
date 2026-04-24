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
from typing import Iterable

from metadata.generated.schema.entity.services.connections.pipeline.fivetranConnection import (
    FivetranConnection,
)
from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import ClientConfig
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_registry import get_verify_ssl_fn

logger = ingestion_logger()


class FivetranClient:
    def __init__(self, config: FivetranConnection):
        self.config = config
        api_token = base64.b64encode(
            f"{config.apiKey}:{config.apiSecret.get_secret_value()}".encode("ascii")
        ).decode("ascii")

        verify_ssl = get_verify_ssl_fn(config.verifySSL)
        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(str(self.config.hostPort)),
            api_version="v1",
            auth_header="Authorization",
            auth_token=lambda: (api_token, 0),
            auth_token_mode="Basic",
            retry=5,
            retry_wait=30,
            retry_codes=[429, 500, 502, 503],
            limit_codes=[],
            verify=verify_ssl(config.sslConfig),
        )
        self.client = TrackedREST(client_config, source_name="fivetran")

    def _get_data(self, path: str) -> dict:
        response = self.client.get(path)
        if response is None:
            raise RuntimeError(
                f"Fivetran API request failed for {path} — received None response"
            )
        if not isinstance(response, dict):
            logger.warning(f"Unexpected response type for {path}: {type(response)}")
            return {}
        data = response.get("data")
        if not isinstance(data, dict):
            logger.warning(f"Missing or invalid 'data' field in response for {path}")
            return {}
        return data

    def _run_paginator(self, path: str) -> Iterable[dict]:
        data = self._get_data(f"{path}?limit={self.config.limit}")
        yield from data.get("items", [])
        while data.get("next_cursor"):
            data = self._get_data(
                f"{path}?limit={self.config.limit}&cursor={data['next_cursor']}"
            )
            yield from data.get("items", [])

    def list_groups(self) -> Iterable[dict]:
        return self._run_paginator("/groups")

    def list_group_connectors(self, group_id: str) -> Iterable[dict]:
        return self._run_paginator(f"/groups/{group_id}/connectors")

    def get_connector_details(self, connector_id: str) -> dict:
        return self._get_data(f"/connectors/{connector_id}")

    def get_destination_details(self, destination_id: str) -> dict:
        return self._get_data(f"/destinations/{destination_id}")

    def get_connector_schema_details(self, connector_id: str) -> dict:
        return self._get_data(f"/connectors/{connector_id}/schemas").get("schemas", {})

    def get_connector_sync_history(self, connector_id: str) -> Iterable[dict]:
        return self._run_paginator(f"/connectors/{connector_id}/sync-history")

    def get_connector_column_lineage(
        self, connector_id: str, schema_name: str, table_name: str
    ) -> dict:
        return self._get_data(
            f"/connectors/{connector_id}/schemas/{schema_name}"
            f"/tables/{table_name}/columns"
        ).get("columns", {})
