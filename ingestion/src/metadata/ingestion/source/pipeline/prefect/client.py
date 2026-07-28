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
Client to interact with the Prefect REST API (Cloud or self-hosted Server)
"""

from collections.abc import Iterable

from metadata.generated.schema.entity.services.connections.pipeline.prefectConnection import (
    PrefectConnection,
)
from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import ClientConfig
from metadata.utils.constants import AUTHORIZATION_HEADER
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_registry import get_verify_ssl_fn

logger = ingestion_logger()

API_VERSION = "api"
FLOWS_PAGE_SIZE = 200  # Prefect API maximum page size
DEPLOYMENTS_PAGE_SIZE = 100
FLOW_RUNS_SORT = "START_TIME_DESC"


class PrefectClient:
    """
    Wrapper on top of the Prefect REST API. Filter endpoints are POST based;
    the parent-flow filter is always the top-level ``flows`` key.
    """

    def __init__(self, config: PrefectConnection):
        self.config = config

        if bool(config.accountId) != bool(config.workspaceId):
            raise ValueError(
                "Both accountId and workspaceId must be provided for Prefect Cloud, "
                "or both must be empty for self-hosted Prefect Server."
            )

        # hostPort may already carry the /api suffix; api_version adds it back
        host = clean_uri(str(config.hostPort)).removesuffix("/api")
        self._path_prefix = f"/accounts/{config.accountId}/workspaces/{config.workspaceId}" if config.accountId else ""

        verify_ssl = get_verify_ssl_fn(config.verifySSL)
        client_config: ClientConfig = ClientConfig(
            base_url=host,
            api_version=API_VERSION,
            # A self-hosted Prefect Server without auth enabled has no API key
            auth_header=AUTHORIZATION_HEADER if config.apiKey else None,
            auth_token=(lambda: (config.apiKey.get_secret_value(), 0)) if config.apiKey else None,
            retry=5,
            retry_wait=30,
            retry_codes=[429, 500, 502, 503],
            limit_codes=[],
            verify=verify_ssl(config.sslConfig),
        )
        self.client = TrackedREST(client_config, source_name="prefect")

    def _filter(self, resource: str, payload: dict, **kwargs) -> list[dict]:
        result = self.client.post(f"{self._path_prefix}/{resource}/filter", json=payload, **kwargs)
        return result if isinstance(result, list) else []

    def get_flows(self) -> Iterable[dict]:
        """Paginate over every flow in the workspace, yielding one at a time."""
        offset = 0
        while True:
            page = self._filter("flows", {"limit": FLOWS_PAGE_SIZE, "offset": offset})
            yield from page
            if len(page) < FLOWS_PAGE_SIZE:
                break
            offset += FLOWS_PAGE_SIZE

    def get_flow_runs(self, flow_id: str, limit: int) -> list[dict]:
        """Most recent runs of one flow, newest first."""
        return self._filter(
            "flow_runs",
            {
                "flows": {"id": {"any_": [flow_id]}},
                "sort": FLOW_RUNS_SORT,
                "limit": limit,
                "offset": 0,
            },
        )

    def get_task_runs(self, flow_run_id: str) -> list[dict]:
        # ponytail: temporary, testing task-run ingestion before the real deployment+task-run merge
        return self._filter(
            "task_runs",
            {"task_runs": {"flow_run_id": {"any_": [flow_run_id]}}, "limit": 200, "offset": 0},
        )

    def get_deployments(self, flow_id: str) -> list[dict]:
        """Every deployment of one flow."""
        deployments: list[dict] = []
        offset = 0
        while True:
            page = self._filter(
                "deployments",
                {
                    "flows": {"id": {"any_": [flow_id]}},
                    "limit": DEPLOYMENTS_PAGE_SIZE,
                    "offset": offset,
                },
            )
            deployments.extend(page)
            if len(page) < DEPLOYMENTS_PAGE_SIZE:
                return deployments
            offset += DEPLOYMENTS_PAGE_SIZE

    def test_check_access(self) -> None:
        """Smallest authenticated call proving host, API key and, on Prefect
        Cloud, the account and workspace ids at once."""
        self._filter("flows", {"limit": 1, "offset": 0}, retries=0)

    def test_get_flows(self) -> list[dict]:
        """Fetch one page of flows for the test connection step."""
        return self._filter("flows", {"limit": FLOWS_PAGE_SIZE, "offset": 0}, retries=0)
