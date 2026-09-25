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

from collections.abc import Iterable

from tableauserverclient import (
    Filter,
    Pager,
    PersonalAccessTokenAuth,
    RequestOptions,
    Server,
    Sort,
    TableauAuth,
)
from tableauserverclient.models import FlowItem, FlowRunItem
from tableauserverclient.server.endpoint.exceptions import ServerResponseError

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
    TABLEAU_METADATA_API_PROBE_QUERY,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.lru_cache import LRUCache
from metadata.utils.ssl_manager import SSLManager

logger = ingestion_logger()

DEFAULT_NUMBER_OF_STATUS = 10
USER_EMAIL_CACHE_SIZE = 512


class TableauPipelineClient:
    """Client for Tableau Pipeline operations (Prep Flows)"""

    def __init__(
        self,
        tableau_server_auth: PersonalAccessTokenAuth | TableauAuth,
        config: TableauPipelineConnection,
        verify_ssl: bool | str | None,
        ssl_manager: SSLManager | None = None,
    ):
        self.tableau_server = Server(str(config.hostPort), use_server_version=True)
        if config.apiVersion:
            self.tableau_server.version = config.apiVersion
        self.tableau_server.add_http_options({"verify": verify_ssl})
        self.tableau_server.auth.sign_in(tableau_server_auth)
        self.config = config
        self.ssl_manager = ssl_manager
        self.number_of_status = config.numberOfStatus or DEFAULT_NUMBER_OF_STATUS
        self._user_emails: LRUCache[str | None] = LRUCache(USER_EMAIL_CACHE_SIZE)

    def get_flows(self) -> Iterable[TableauFlowItem]:
        """Fetch all Tableau Prep flows"""
        flow: FlowItem
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
                tags=sorted(flow.tags) if flow.tags else [],
            )

    def get_user_email(self, user_id: str) -> str | None:
        """Resolve a Tableau user id to an email address, or None on failure.

        A single owner typically owns many flows, so lookups (misses included)
        are cached. Tableau Cloud usernames are email addresses, so the username
        is used when the email attribute is empty."""
        if not user_id:
            return None
        if user_id in self._user_emails:
            return self._user_emails.get(user_id)
        try:
            user = self.tableau_server.users.get_by_id(user_id)
            email = user.email or (user.name if user.name and "@" in user.name else None)
        except Exception as exc:
            logger.debug("Unable to resolve Tableau user %s: %s", user_id, exc)
            email = None
        self._user_emails.put(user_id, email)
        return email

    def get_flow_runs(self, flow_id: str) -> list[TableauFlowRunItem]:
        """Return the most recent `numberOfStatus` runs of a flow, newest first.

        Get Flow Runs filters on flowId and sorts on any filterable field, so one
        request per flow is enough. TSC's FlowRuns.get returns a bare list rather
        than (items, pagination), so it cannot be driven through Pager.
        ref: https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_concepts_filtering_and_sorting.htm
        """
        try:
            runs = self.tableau_server.flow_runs.get(self._flow_runs_options(flow_id, newest_first=True))
        except ServerResponseError as exc:
            # The Get Flow Runs reference documents the filter but not the sort; a
            # server that rejects it still answers the filter-only request.
            if not str(exc.code).startswith("400"):
                raise
            logger.debug("Tableau rejected sorting flow runs, retrying unsorted: %s", exc)
            runs = self.tableau_server.flow_runs.get(self._flow_runs_options(flow_id, newest_first=False))

        items = [self._to_run_item(run) for run in runs]
        items.sort(key=lambda run: run.started_at.timestamp() if run.started_at else 0.0, reverse=True)
        return items[: self.number_of_status]

    def _flow_runs_options(self, flow_id: str, newest_first: bool) -> RequestOptions:
        options = RequestOptions(pagesize=self.number_of_status) if newest_first else RequestOptions()
        options.filter.add(Filter(RequestOptions.Field.FlowId, RequestOptions.Operator.Equals, flow_id))
        if newest_first:
            options.sort.add(Sort(RequestOptions.Field.StartedAt, RequestOptions.Direction.Desc))
        return options

    @staticmethod
    def _to_run_item(run: FlowRunItem) -> TableauFlowRunItem:
        return TableauFlowRunItem(
            id=str(run.id),
            flow_id=str(run.flow_id) if run.flow_id else None,
            status=run.status,
            started_at=run.started_at,
            completed_at=run.completed_at,
            progress=run.progress,
        )

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

    def test_get_flows(self) -> list[FlowItem]:
        flows, _ = self.tableau_server.flows.get(RequestOptions(pagesize=1))
        return flows

    def test_get_flow_runs(self) -> list[FlowRunItem]:
        return self.tableau_server.flow_runs.get(RequestOptions(pagesize=1))

    def test_metadata_api(self) -> None:
        """Run a real flow query so a disabled Metadata API or a query the
        server rejects fails here instead of silently yielding no lineage."""
        self.tableau_server.metadata.query(query=TABLEAU_METADATA_API_PROBE_QUERY, abort_on_error=True)

    def get_flow_lineage(self, flow_luid: str) -> TableauFlowLineage | None:
        """Fetch the inputs and outputs of a flow via the Metadata API.

        Returns None when the Metadata API is unavailable or the flow has no
        lineage records yet (the Metadata store lags live publishes by a few
        minutes on Tableau Server).
        """
        try:
            result = self.tableau_server.metadata.query(query=TABLEAU_FLOW_LINEAGE_QUERY.format(flow_luid=flow_luid))
        except Exception as exc:
            logger.warning(
                "Tableau Metadata API lineage query failed for flow %s: %s. Lineage requires the Metadata API: "
                "https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html",
                flow_luid,
                exc,
            )
            return None

        # A node-limit or permission error still returns partial data next to
        # `errors`; keep the data but make the truncation visible.
        if result.get("errors"):
            logger.warning("Tableau Metadata API returned errors for flow %s: %s", flow_luid, result["errors"])

        flows = (result.get("data") or {}).get("flows") or []
        if not flows:
            logger.debug("Metadata API returned no flow record for luid=%s", flow_luid)
            return None

        try:
            return TableauFlowLineage.model_validate(flows[0])
        except Exception as exc:
            logger.debug("Failed to parse flow lineage response: %s", exc)
            return None

    def sign_out(self) -> None:
        try:
            self.tableau_server.auth.sign_out()
        finally:
            self.cleanup()

    def cleanup(self) -> None:
        self._user_emails.clear()
        if self.ssl_manager:
            self.ssl_manager.cleanup_temp_files()
