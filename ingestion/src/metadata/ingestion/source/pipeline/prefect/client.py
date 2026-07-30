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

import base64
from collections.abc import Iterable
from functools import lru_cache

from metadata.generated.schema.entity.services.connections.pipeline.prefect.cloudAuth import (
    PrefectCloudAuthentication,
)
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

    @staticmethod
    def _auth(auth: PrefectCloudAuthentication | object):
        """Cloud is always Bearer; self-hosted Server is Basic when authString
        is set, otherwise no auth header at all."""
        if isinstance(auth, PrefectCloudAuthentication):
            return AUTHORIZATION_HEADER, (lambda: (auth.apiKey.get_secret_value(), 0)), "Bearer"
        if auth.authString:
            token = base64.b64encode(auth.authString.get_secret_value().encode()).decode()
            return AUTHORIZATION_HEADER, (lambda: (token, 0)), "Basic"
        return None, None, None

    def __init__(self, config: PrefectConnection):
        self.config = config
        auth = config.authType

        # hostPort may already carry the /api suffix; api_version adds it back
        host = clean_uri(str(auth.hostPort)).removesuffix("/api")
        self._path_prefix = (
            f"/accounts/{auth.accountId}/workspaces/{auth.workspaceId}"
            if isinstance(auth, PrefectCloudAuthentication)
            else ""
        )

        verify_ssl = get_verify_ssl_fn(config.verifySSL)
        auth_header, auth_token, auth_token_mode = self._auth(auth)
        client_config: ClientConfig = ClientConfig(
            base_url=host,
            api_version=API_VERSION,
            auth_header=auth_header,
            auth_token=auth_token,
            auth_token_mode=auth_token_mode,
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

    @lru_cache(maxsize=256)  # noqa: B019 — bounded, keyed by (self, flow_id, limit, exclude_scheduled)
    def get_flow_runs(self, flow_id: str, limit: int, exclude_scheduled: bool = False) -> list[dict]:
        """Most recent runs of one flow, newest first. Cached — yield_tag and
        yield_pipeline both fetch the same flow's latest run independently.

        ``exclude_scheduled=True`` drops not-yet-started runs (state SCHEDULED) —
        an active-schedule deployment pre-creates these with future start_times,
        which would otherwise outrank every real past run under START_TIME_DESC
        and starve the DAG/task-status build of a run that actually has task runs.
        """
        payload = {
            "flows": {"id": {"any_": [flow_id]}},
            "sort": FLOW_RUNS_SORT,
            "limit": limit,
            "offset": 0,
        }
        if exclude_scheduled:
            payload["flow_runs"] = {"state": {"type": {"not_any_": ["SCHEDULED"]}}}
        return self._filter("flow_runs", payload)

    @lru_cache(maxsize=256)  # noqa: B019 — bounded, keyed by (self, flow_run_id), lives one ingestion run
    def get_task_runs(self, flow_run_id: str) -> list[dict]:
        """Task runs of one flow run. Cached — the same flow run's task runs
        are read from multiple places (pipeline build, tags, status)."""
        return self.get_task_runs_for_flow_runs([flow_run_id])[flow_run_id]

    def get_task_runs_for_flow_runs(self, flow_run_ids: list[str]) -> dict[str, list[dict]]:
        """Task runs for many flow runs in one paginated call, grouped by
        flow_run_id — avoids one request per historical run when building
        pipeline status for a flow with many runs."""
        if not flow_run_ids:
            return {}
        task_runs: list[dict] = []
        offset = 0
        while True:
            page = self._filter(
                "task_runs",
                {"task_runs": {"flow_run_id": {"any_": flow_run_ids}}, "limit": 200, "offset": offset},
            )
            task_runs.extend(page)
            if len(page) < 200:
                break
            offset += 200
        grouped: dict[str, list[dict]] = {flow_run_id: [] for flow_run_id in flow_run_ids}
        for task_run in task_runs:
            grouped[task_run["flow_run_id"]].append(task_run)
        return grouped

    @lru_cache(maxsize=256)  # noqa: B019 — bounded, keyed by (self, flow_id), lives one ingestion run
    def get_deployments(self, flow_id: str) -> list[dict]:
        """Every deployment of one flow, newest-created first. Cached — tags,
        schedule, and lineage tag parsing all fetch the same flow's
        deployments independently, so this avoids re-paginating per call."""
        deployments: list[dict] = []
        offset = 0
        while True:
            page = self._filter(
                "deployments",
                {
                    "flows": {"id": {"any_": [flow_id]}},
                    "sort": "CREATED_DESC",
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
