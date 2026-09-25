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

from collections.abc import Iterable, Iterator
from typing import Literal

from tableauserverclient import (
    Filter,
    Pager,
    PersonalAccessTokenAuth,
    RequestOptions,
    Server,
    Sort,
    TableauAuth,
)
from tableauserverclient.models import BackgroundJobItem, FlowItem, FlowRunItem, TaskItem
from tableauserverclient.server.endpoint.exceptions import ServerResponseError

from metadata.generated.schema.entity.services.connections.pipeline.tableauPipelineConnection import (
    TableauPipelineConnection,
)
from metadata.ingestion.source.pipeline.tableaupipeline.models import (
    TableauFlowItem,
    TableauFlowLineage,
    TableauPipelineDetails,
    TableauRunItem,
    TableauTaskType,
)
from metadata.ingestion.source.pipeline.tableaupipeline.queries import (
    TABLEAU_FLOW_LINEAGE_QUERY,
    TABLEAU_METADATA_API_PROBE_QUERY,
    TABLEAU_PUBLISHED_DATASOURCE_ID_QUERY,
    TABLEAU_WORKBOOK_EXTRACTS_QUERY,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.lru_cache import LRUCache
from metadata.utils.ssl_manager import SSLManager

logger = ingestion_logger()

DEFAULT_NUMBER_OF_STATUS = 10
USER_EMAIL_CACHE_SIZE = 512
EXTRACT_REFRESH_JOB_TYPES = ["refresh_extracts", "increment_extracts"]
JOBS_PAGE_SIZE = 100
# Only the per-job Query Job call says which data source or workbook a refresh
# job refreshed, so each job costs one request; cap them per ingestion.
MAX_EXTRACT_REFRESH_JOB_LOOKUPS = 1000
METADATA_API_DOC = "https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html"

ExtractTargetType = Literal["datasource", "workbook"]


class TableauSiteAdminRequiredError(Exception):
    """Query Jobs answers only server and site administrators."""


def _has_status(exc: ServerResponseError, status: int) -> bool:
    return str(exc.code).startswith(str(status))


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
        self._extract_targets: frozenset[str] = frozenset()
        # Holds at most MAX_EXTRACT_REFRESH_JOB_LOOKUPS runs, one per looked-up job.
        self._extract_runs: dict[str, list[TableauRunItem]] | None = None

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

    def get_flow_runs(self, flow_id: str) -> list[TableauRunItem]:
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
            if not _has_status(exc, 400):
                raise
            logger.debug("Tableau rejected sorting flow runs, retrying unsorted: %s", exc)
            runs = self.tableau_server.flow_runs.get(self._flow_runs_options(flow_id, newest_first=False))

        background_jobs = {str(run.id): run.background_job_id for run in runs}
        items = _newest_first([self._to_run_item(run) for run in runs])[: self.number_of_status]
        for item in items:
            job_id = background_jobs.get(item.id)
            if item.status == "Failed" and job_id:
                item.error = self._job_notes(job_id)
        return items

    def _flow_runs_options(self, flow_id: str, newest_first: bool) -> RequestOptions:
        options = RequestOptions(pagesize=self.number_of_status) if newest_first else RequestOptions()
        options.filter.add(Filter(RequestOptions.Field.FlowId, RequestOptions.Operator.Equals, flow_id))
        if newest_first:
            options.sort.add(Sort(RequestOptions.Field.StartedAt, RequestOptions.Direction.Desc))
        return options

    @staticmethod
    def _to_run_item(run: FlowRunItem) -> TableauRunItem:
        return TableauRunItem(
            id=str(run.id),
            status=run.status,
            started_at=run.started_at,
            completed_at=run.completed_at,
        )

    def _job_notes(self, job_id: str) -> str | None:
        """Tableau's notes on a background job, which carry the failure reason."""
        try:
            notes = self.tableau_server.jobs.get_by_id(job_id).notes
        except Exception as exc:
            logger.debug("Unable to read Tableau job %s: %s", job_id, exc)
            return None
        return "\n".join(note for note in notes if note) or None

    def get_pipelines(self) -> Iterable[TableauPipelineDetails]:
        """Get all pipelines — Prep flows, then extract refreshes — without run history"""
        yield from self._get_flow_pipelines()
        if self.config.includeExtractRefreshes:
            yield from self.get_extract_refresh_pipelines()

    def _get_flow_pipelines(self) -> Iterable[TableauPipelineDetails]:
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

    def get_extract_refresh_pipelines(self) -> Iterable[TableauPipelineDetails]:
        """One pipeline per published data source or workbook with an extract
        refresh task. Non-admin users only see the refresh tasks they own."""
        targets: dict[str, ExtractTargetType] = {}
        try:
            task: TaskItem
            for task in Pager(self.tableau_server.tasks):
                if task.target is not None and task.target.id:
                    targets.setdefault(str(task.target.id), task.target.type)
        except Exception as exc:
            logger.warning("Unable to list Tableau extract refresh tasks: %s", exc)
        self._extract_targets = frozenset(targets)
        self._extract_runs = None

        for target_id, target_type in targets.items():
            details = self._extract_refresh_pipeline(target_id, target_type)
            if details is not None:
                yield details

    def _extract_refresh_pipeline(
        self, target_id: str, target_type: ExtractTargetType
    ) -> TableauPipelineDetails | None:
        endpoint = self.tableau_server.datasources if target_type == "datasource" else self.tableau_server.workbooks
        try:
            item = endpoint.get_by_id(target_id)
        except Exception as exc:
            logger.warning("Skipping the extract refresh of Tableau %s %s: %s", target_type, target_id, exc)
            return None
        noun = "published data source" if target_type == "datasource" else "workbook"
        return TableauPipelineDetails(
            id=target_id,
            name=target_id,
            display_name=f"{item.name} extract refresh",
            description=f"Refreshes the extract of the {noun} **{item.name}**.",
            pipeline_type=TableauTaskType.EXTRACT_REFRESH,
            project_name=item.project_name,
            webpage_url=item.webpage_url,
            owner_id=str(item.owner_id) if item.owner_id else None,
            target_type=target_type,
        )

    def get_extract_refresh_runs(self, target_id: str) -> list[TableauRunItem]:
        """Return the most recent `numberOfStatus` refresh jobs of a data source
        or workbook, newest first. The site's job history is read once, on the
        first call, for every target listed by get_extract_refresh_pipelines."""
        if self._extract_runs is None:
            self._extract_runs = self._scan_extract_refresh_jobs()
        return self._extract_runs.get(target_id, [])

    def _scan_extract_refresh_jobs(self) -> dict[str, list[TableauRunItem]]:
        """Index recent extract refresh jobs by the data source or workbook they refreshed.

        Query Jobs cannot filter by target, so jobs are read newest first and each
        is looked up until every target has `numberOfStatus` runs or the lookup cap
        is reached. Queued jobs are skipped: they become runs once they start.
        """
        runs: dict[str, list[TableauRunItem]] = {target: [] for target in self._extract_targets}
        if not runs:
            return runs
        incomplete = len(runs)
        lookups = 0
        try:
            for job in self._extract_refresh_jobs():
                if incomplete == 0:
                    break
                if job.started_at is None:
                    continue
                if lookups >= MAX_EXTRACT_REFRESH_JOB_LOOKUPS:
                    logger.warning(
                        "Read %s Tableau extract refresh jobs; older refreshes are not ingested this run.",
                        MAX_EXTRACT_REFRESH_JOB_LOOKUPS,
                    )
                    break
                lookups += 1
                target_runs, error = self._refresh_job_target(job, runs)
                if target_runs is None or len(target_runs) >= self.number_of_status:
                    continue
                target_runs.append(
                    TableauRunItem(
                        id=str(job.id),
                        status=job.status,
                        started_at=job.started_at,
                        completed_at=job.ended_at,
                        error=error if job.status == "Failed" else None,
                    )
                )
                if len(target_runs) == self.number_of_status:
                    incomplete -= 1
        except Exception as exc:
            # Any failure ends the scan with what was read, so it is not retried
            # for every extract refresh pipeline.
            if isinstance(exc, ServerResponseError) and _has_status(exc, 403):
                logger.warning(
                    "Tableau extract refresh history needs a site administrator; "
                    "extract refresh pipelines are ingested without status."
                )
            else:
                logger.warning("Unable to read Tableau extract refresh jobs: %s", exc)
        return {target: _newest_first(target_runs) for target, target_runs in runs.items()}

    def _refresh_job_target(
        self, job: BackgroundJobItem, runs: dict[str, list[TableauRunItem]]
    ) -> tuple[list[TableauRunItem] | None, str | None]:
        """The run list of the target a refresh job refreshed, and the job's notes."""
        try:
            detail = self.tableau_server.jobs.get_by_id(job.id)
        except ServerResponseError as exc:
            if _has_status(exc, 403):
                raise
            logger.debug("Unable to read Tableau job %s: %s", job.id, exc)
            return None, None
        target = detail.datasource_id or detail.workbook_id
        notes = "\n".join(note for note in detail.notes if note) or None
        return runs.get(str(target)) if target else None, notes

    def _extract_refresh_jobs(self) -> Iterator[BackgroundJobItem]:
        newest_first = True
        page = 1
        while True:
            try:
                jobs, pagination = self.tableau_server.jobs.get(
                    job_id=None, req_options=self._jobs_options(page, newest_first)
                )
            except ServerResponseError as exc:
                if not (newest_first and page == 1 and _has_status(exc, 400)):
                    raise
                logger.debug("Tableau rejected sorting jobs, retrying unsorted: %s", exc)
                newest_first = False
                continue
            yield from jobs
            if not jobs or page * pagination.page_size >= pagination.total_available:
                return
            page += 1

    @staticmethod
    def _jobs_options(page: int, newest_first: bool) -> RequestOptions:
        options = RequestOptions(pagenumber=page, pagesize=JOBS_PAGE_SIZE)
        options.filter.add(Filter(RequestOptions.Field.JobType, RequestOptions.Operator.In, EXTRACT_REFRESH_JOB_TYPES))
        if newest_first:
            options.sort.add(Sort(RequestOptions.Field.CreatedAt, RequestOptions.Direction.Desc))
        return options

    def get_extract_datasource_ids(self, target_type: ExtractTargetType, target_luid: str) -> list[str]:
        """Metadata API ids of the data sources an extract refresh writes: the
        published data source itself, or a workbook's embedded extracts."""
        if target_type == "datasource":
            data = self._metadata_query(
                TABLEAU_PUBLISHED_DATASOURCE_ID_QUERY.format(luid=target_luid), f"data source {target_luid}"
            )
            return [ds["id"] for ds in data.get("publishedDatasources") or [] if ds.get("id")]
        data = self._metadata_query(TABLEAU_WORKBOOK_EXTRACTS_QUERY.format(luid=target_luid), f"workbook {target_luid}")
        return [
            ds["id"]
            for workbook in data.get("workbooks") or []
            for ds in workbook.get("embeddedDatasources") or []
            if ds.get("hasExtracts") and ds.get("id")
        ]

    def test_get_flows(self) -> list[FlowItem]:
        flows, _ = self.tableau_server.flows.get(RequestOptions(pagesize=1))
        return flows

    def test_get_flow_runs(self) -> list[FlowRunItem]:
        return self.tableau_server.flow_runs.get(RequestOptions(pagesize=1))

    def test_get_extract_refresh_jobs(self) -> list[BackgroundJobItem]:
        try:
            jobs, _ = self.tableau_server.jobs.get(job_id=None, req_options=RequestOptions(pagesize=1))
        except ServerResponseError as exc:
            if _has_status(exc, 403):
                raise TableauSiteAdminRequiredError(str(exc)) from exc
            raise
        return jobs

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
        data = self._metadata_query(TABLEAU_FLOW_LINEAGE_QUERY.format(flow_luid=flow_luid), f"flow {flow_luid}")
        flows = data.get("flows") or []
        if not flows:
            logger.debug("Metadata API returned no flow record for luid=%s", flow_luid)
            return None

        try:
            return TableauFlowLineage.model_validate(flows[0])
        except Exception as exc:
            logger.debug("Failed to parse flow lineage response: %s", exc)
            return None

    def _metadata_query(self, query: str, subject: str) -> dict:
        try:
            result = self.tableau_server.metadata.query(query=query)
        except Exception as exc:
            logger.warning(
                "Tableau Metadata API query failed for %s: %s. Lineage requires the Metadata API: %s",
                subject,
                exc,
                METADATA_API_DOC,
            )
            return {}
        # A node-limit or permission error still returns partial data next to
        # `errors`; keep the data but make the truncation visible.
        if result.get("errors"):
            logger.warning("Tableau Metadata API returned errors for %s: %s", subject, result["errors"])
        return result.get("data") or {}

    def sign_out(self) -> None:
        try:
            self.tableau_server.auth.sign_out()
        finally:
            self.cleanup()

    def cleanup(self) -> None:
        self._user_emails.clear()
        self._extract_targets = frozenset()
        self._extract_runs = None
        if self.ssl_manager:
            self.ssl_manager.cleanup_temp_files()


def _newest_first(runs: list[TableauRunItem]) -> list[TableauRunItem]:
    return sorted(runs, key=lambda run: run.started_at.timestamp() if run.started_at else 0.0, reverse=True)
