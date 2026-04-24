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
Tableau Pipeline Client - wraps tableauserverclient for pipeline operations
"""

from typing import Dict, Iterable, Iterator, List, Optional, Union

from tableauserverclient import (
    Pager,
    PersonalAccessTokenAuth,
    RequestOptions,
    Server,
    TableauAuth,
)

from metadata.generated.schema.entity.services.connections.pipeline.tableauPipelineConnection import (
    TableauPipelineConnection,
)
from metadata.ingestion.source.pipeline.tableaupipeline.models import (
    TableauFlowItem,
    TableauFlowLineage,
    TableauFlowRunItem,
    TableauPipelineDetails,
    TableauTaskType,
)
from metadata.ingestion.source.pipeline.tableaupipeline.queries import (
    TABLEAU_FLOW_LINEAGE_QUERY,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import SSLManager

logger = ingestion_logger()

DEFAULT_NUMBER_OF_STATUS = 10
MAX_FLOW_RUNS_HARD_LIMIT = 10000


class TableauPipelineClient:
    """Client for Tableau Pipeline operations (Prep Flows)"""

    def __init__(
        self,
        tableau_server_auth: Union[PersonalAccessTokenAuth, TableauAuth],
        config: TableauPipelineConnection,
        verify_ssl: Union[bool, str, None],
        ssl_manager: Optional[SSLManager] = None,
    ):
        self.tableau_server = Server(str(config.hostPort), use_server_version=True)
        if config.apiVersion:
            self.tableau_server.version = config.apiVersion
        self.tableau_server.add_http_options({"verify": verify_ssl})
        self.tableau_server.auth.sign_in(tableau_server_auth)
        self.config = config
        self.ssl_manager = ssl_manager
        self.number_of_status = (
            getattr(config, "numberOfStatus", None) or DEFAULT_NUMBER_OF_STATUS
        )
        self._runs_by_flow: Dict[str, List[TableauFlowRunItem]] = {}
        self._runs_iter: Optional[Iterator] = None
        self._runs_iter_exhausted: bool = False
        self._runs_scanned: int = 0
        self._user_email_cache: Dict[str, Optional[str]] = {}

    def get_flows(self) -> Iterable[TableauFlowItem]:
        """Fetch all Tableau Prep flows"""
        for flow in Pager(self.tableau_server.flows):
            yield TableauFlowItem(
                id=str(flow.id),
                name=flow.name,
                description=flow.description,
                project_id=str(flow.project_id) if flow.project_id else None,
                project_name=flow.project_name,
                owner_id=str(flow.owner_id) if flow.owner_id else None,
                webpage_url=flow.webpage_url,
                created_at=flow.created_at,
                updated_at=flow.updated_at,
                tags=sorted(flow.tags) if getattr(flow, "tags", None) else [],
            )

    def get_user_email(self, user_id: str) -> Optional[str]:
        """Resolve a Tableau user id to an email address, or None on failure.

        Cached per client instance because a single flow owner typically
        owns many flows and the API charges per call.
        """
        if not user_id:
            return None
        cache = self._user_email_cache
        if user_id in cache:
            return cache[user_id]
        try:
            user = self.tableau_server.users.get_by_id(user_id)
            email = getattr(user, "email", None) or getattr(user, "name", None)
        except Exception as exc:
            logger.debug(f"Unable to resolve Tableau user {user_id}: {exc}")
            email = None
        cache[user_id] = email
        return email

    def _ensure_runs_for(self, flow_id: str) -> None:
        """Advance the lazy flow-runs iterator until `flow_id` has
        `number_of_status` runs cached, the iterator exhausts, or the
        hard limit is hit.

        Streaming approach sidesteps the fact that Tableau's REST API
        only exposes `/flows/runs` at the site level (and TSC's
        RequestOptions filter enum has no FlowId field): we still have
        to scan the site-wide stream, but we stop as soon as we have
        enough for the flow being asked about. When `pipelineFilterPattern`
        excludes most flows, subsequent calls for the remaining flows
        reuse the already-scanned runs without re-paging.

        Assumes Tableau returns runs ordered newest-first — per-flow
        caches accept runs in arrival order up to `number_of_status`.
        If the ordering assumption ever breaks the cached runs will
        still be correct per-flow, just not guaranteed to be the
        most recent N."""
        if self._has_enough_runs(flow_id) or self._runs_iter_exhausted:
            return
        if self._runs_iter is None:
            self._runs_iter = iter(Pager(self.tableau_server.flow_runs))

        for run in self._runs_iter:
            self._runs_scanned += 1
            if run.flow_id:
                run_flow_id = str(run.flow_id)
                cached = self._runs_by_flow.setdefault(run_flow_id, [])
                if len(cached) < self.number_of_status:
                    cached.append(
                        TableauFlowRunItem(
                            id=str(run.id),
                            flow_id=run_flow_id,
                            status=run.status,
                            started_at=run.started_at,
                            completed_at=run.completed_at,
                            progress=run.progress,
                        )
                    )
            if self._runs_scanned >= MAX_FLOW_RUNS_HARD_LIMIT:
                self._runs_iter_exhausted = True
                logger.warning(
                    f"Reached hard flow-run traversal limit "
                    f"({MAX_FLOW_RUNS_HARD_LIMIT}). Some older runs may "
                    "be excluded. Consider lowering numberOfStatus or "
                    "tightening pipelineFilterPattern."
                )
                return
            if self._has_enough_runs(flow_id):
                return

        self._runs_iter_exhausted = True

    def _has_enough_runs(self, flow_id: str) -> bool:
        cached = self._runs_by_flow.get(flow_id)
        return cached is not None and len(cached) >= self.number_of_status

    def get_flow_runs(self, flow_id: str) -> List[TableauFlowRunItem]:
        """Return the most recent runs for a flow. Streams lazily — reads
        just enough of the global flow-runs list to satisfy the request."""
        self._ensure_runs_for(flow_id)
        return list(self._runs_by_flow.get(flow_id, []))

    def clear_flow_runs_cache(self) -> None:
        """Reset the streaming state. Called during sign_out cleanup so a
        reused client starts fresh."""
        self._runs_by_flow.clear()
        self._runs_iter = None
        self._runs_iter_exhausted = False
        self._runs_scanned = 0

    def get_pipelines(self) -> Iterable[TableauPipelineDetails]:
        """Get all pipelines (Prep Flows) without run history"""
        for flow in self.get_flows():
            yield TableauPipelineDetails(
                id=flow.id,
                name=flow.id,
                display_name=flow.name,
                description=flow.description,
                pipeline_type=TableauTaskType.FLOW_RUN,
                project_name=flow.project_name,
                webpage_url=flow.webpage_url,
                owner_id=flow.owner_id,
                tags=flow.tags,
            )

    def test_get_flows(self) -> None:
        """Validate that we can list flows. Raises on failure."""
        req_options = RequestOptions(pagesize=1)
        self.tableau_server.flows.get(req_options)

    def test_metadata_api(self) -> None:
        """Validate the Tableau Metadata API is reachable. Raises on failure.

        Used as a non-mandatory connection test so users without the Metadata
        API enabled still pass base connection validation — lineage just won't
        be extracted.
        """
        self.tableau_server.metadata.query(query="{ serverInfo { serverName } }")

    def get_flow_lineage(self, flow_luid: str) -> Optional[TableauFlowLineage]:
        """Fetch upstream and output lineage for a flow via the Metadata API.

        Returns None when the Metadata API is unavailable or the flow has no
        lineage records yet (the Metadata store lags live publishes by a few
        minutes on Tableau Server).
        """
        try:
            result = self.tableau_server.metadata.query(
                query=TABLEAU_FLOW_LINEAGE_QUERY.format(flow_luid=flow_luid)
            )
        except Exception as exc:
            logger.debug(
                "Failed to query Tableau Metadata API for flow lineage. "
                "Ensure the Metadata API is enabled: "
                "https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html"
            )
            logger.warning(f"Tableau Metadata API lineage query failed: {exc}")
            return None

        if not result or not result.get("data"):
            logger.debug(f"No lineage data returned for flow luid={flow_luid}")
            return None

        flows = result["data"].get("flows") or []
        if not flows:
            logger.debug(f"Metadata API returned no flow record for luid={flow_luid}")
            return None

        try:
            return TableauFlowLineage.model_validate(flows[0])
        except Exception as exc:
            logger.debug(f"Failed to parse flow lineage response: {exc}")
            return None

    def sign_out(self) -> None:
        try:
            self.tableau_server.auth.sign_out()
        finally:
            self.cleanup()

    def cleanup(self) -> None:
        self.clear_flow_runs_cache()
        if self.ssl_manager:
            self.ssl_manager.cleanup_temp_files()
