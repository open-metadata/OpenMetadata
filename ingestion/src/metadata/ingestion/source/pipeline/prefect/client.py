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
Client to interact with the Prefect REST API (Cloud or self-hosted Server).
https://docs.prefect.io/v3/api-ref/rest-api
"""

import base64
from collections.abc import Iterable
from typing import Any

from cachetools import LRUCache

from metadata.generated.schema.entity.services.connections.pipeline.prefect.cloudAuth import (
    PrefectCloudAuthentication,
)
from metadata.generated.schema.entity.services.connections.pipeline.prefect.serverAuth import (
    PrefectServerAuthentication,
)
from metadata.generated.schema.entity.services.connections.pipeline.prefectConnection import (
    PrefectConnection,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL
from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import ClientConfig
from metadata.ingestion.source.pipeline.prefect.models import (
    AssetMaterialization,
    PrefectDeployment,
    PrefectFlow,
    PrefectFlowRun,
    PrefectTaskRun,
)
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
    def _auth(auth: PrefectCloudAuthentication | PrefectServerAuthentication):
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
        host = clean_uri(str(config.hostPort)).removesuffix("/api")
        self._path_prefix = (
            f"/accounts/{auth.accountId}/workspaces/{auth.workspaceId}"
            if isinstance(auth, PrefectCloudAuthentication)
            else ""
        )

        verify_ssl = get_verify_ssl_fn(config.verifySSL or VerifySSL.no_ssl)
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

        # Instance-level caches, not @lru_cache on the method — that keys on
        # self and pins this PrefectClient (and everything it references)
        # alive for as long as the process runs, not just this ingestion run.
        # Same pattern as the OpenLineage/dbtcloud connectors.
        self._flow_runs_cache: LRUCache = LRUCache(maxsize=256)
        self._task_runs_cache: LRUCache = LRUCache(maxsize=256)
        self._deployments_cache: LRUCache = LRUCache(maxsize=256)

    def _filter(self, resource: str, payload: dict, **kwargs: Any) -> list[dict]:
        result = self.client.post(f"{self._path_prefix}/{resource}/filter", json=payload, **kwargs)
        return result if isinstance(result, list) else []

    def get_flows(self) -> Iterable[PrefectFlow]:
        """Paginate over every flow in the workspace, yielding one at a time."""
        offset = 0
        total = 0
        while True:
            page = self._filter("flows", {"limit": FLOWS_PAGE_SIZE, "offset": offset})
            total += len(page)
            yield from (PrefectFlow.model_validate(flow) for flow in page)
            if len(page) < FLOWS_PAGE_SIZE:
                break
            offset += FLOWS_PAGE_SIZE
        logger.debug("Fetched %d flows", total)

    def get_flow_runs(self, flow_id: str, limit: int) -> list[PrefectFlowRun]:
        """Most recent runs of one flow, newest first. Cached — yield_tag and
        yield_pipeline both fetch the same flow's latest run independently.

        Drops not-yet-started runs (state SCHEDULED) — an active-schedule
        deployment pre-creates these with future start_times, which would
        otherwise outrank every real past run under START_TIME_DESC and
        starve the DAG/task-status build of a run that actually has task runs.
        """
        cache_key = (flow_id, limit)
        if cache_key in self._flow_runs_cache:
            return self._flow_runs_cache[cache_key]
        payload = {
            "flows": {"id": {"any_": [flow_id]}},
            "sort": FLOW_RUNS_SORT,
            "limit": limit,
            "offset": 0,
            "flow_runs": {"state": {"type": {"not_any_": ["SCHEDULED"]}}},
        }
        runs = [PrefectFlowRun.model_validate(run) for run in self._filter("flow_runs", payload)]
        logger.debug("Fetched %d flow runs for flow %s", len(runs), flow_id)
        self._flow_runs_cache[cache_key] = runs
        return runs

    def get_task_runs(self, flow_run_id: str) -> list[PrefectTaskRun]:
        """Task runs of one flow run. Cached — the same flow run's task runs
        are read from multiple places (pipeline build, tags, status)."""
        if flow_run_id in self._task_runs_cache:
            return self._task_runs_cache[flow_run_id]
        task_runs = self.get_task_runs_for_flow_runs([flow_run_id])[flow_run_id]
        self._task_runs_cache[flow_run_id] = task_runs
        return task_runs

    def get_task_runs_for_flow_runs(self, flow_run_ids: list[str]) -> dict[str, list[PrefectTaskRun]]:
        """Task runs for many flow runs in one paginated call, grouped by
        flow_run_id — avoids one request per historical run when building
        pipeline status for a flow with many runs."""
        if not flow_run_ids:
            return {}
        grouped: dict[str, list[PrefectTaskRun]] = {flow_run_id: [] for flow_run_id in flow_run_ids}
        offset = 0
        while True:
            page = self._filter(
                "task_runs",
                {"task_runs": {"flow_run_id": {"any_": flow_run_ids}}, "limit": 200, "offset": offset},
            )
            for task_run in page:
                validated = PrefectTaskRun.model_validate(task_run)
                grouped[validated.flow_run_id].append(validated)
            if len(page) < 200:
                break
            offset += 200
        logger.debug("Fetched %d task runs for %d flow runs", sum(len(v) for v in grouped.values()), len(flow_run_ids))
        return grouped

    def get_deployments(self, flow_id: str) -> list[PrefectDeployment]:
        """Every deployment of one flow, newest-created first. Cached — tags,
        schedule, and lineage tag parsing all fetch the same flow's
        deployments independently, so this avoids re-paginating per call."""
        if flow_id in self._deployments_cache:
            return self._deployments_cache[flow_id]
        deployments: list[PrefectDeployment] = []
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
            deployments.extend(PrefectDeployment.model_validate(deployment) for deployment in page)
            if len(page) < DEPLOYMENTS_PAGE_SIZE:
                logger.debug("Fetched %d deployments for flow %s", len(deployments), flow_id)
                self._deployments_cache[flow_id] = deployments
                return deployments
            offset += DEPLOYMENTS_PAGE_SIZE

    def get_asset_materializations(self, flow_run_id: str) -> list[AssetMaterialization]:
        """Asset materializations for one flow run — Cloud only, the self-hosted
        Server has no Assets API at all. Gives exact upstream/downstream table
        pairs scoped to this one run, unlike deployment tags which carry no
        per-pair mapping. Not cached — called once per pipeline's lineage build."""
        result = self.client.get(f"{self._path_prefix}/flow_runs/{flow_run_id}/assets/materializations")
        materializations = (
            [AssetMaterialization.model_validate(entry) for entry in result] if isinstance(result, list) else []
        )
        logger.debug("Fetched %d asset materializations for flow run %s", len(materializations), flow_run_id)
        return materializations

    def test_check_access(self) -> None:
        """Smallest authenticated call proving host, API key and, on Prefect
        Cloud, the account and workspace ids at once."""
        self._filter("flows", {"limit": 1, "offset": 0}, retries=0)

    def test_get_flows(self) -> list[dict]:
        """Fetch one page of flows for the test connection step."""
        return self._filter("flows", {"limit": FLOWS_PAGE_SIZE, "offset": 0}, retries=0)
