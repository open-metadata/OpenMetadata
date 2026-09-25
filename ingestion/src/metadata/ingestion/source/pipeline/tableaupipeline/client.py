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
Tableau Pipeline client - wraps tableauserverclient and the Tableau Metadata API
for Prep flows and extract refreshes
"""

import heapq
import json
from collections.abc import Callable, Iterable, Iterator

import requests
from requests.adapters import HTTPAdapter
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
from urllib3.util.retry import Retry

from metadata.generated.schema.entity.services.connections.pipeline.tableauPipelineConnection import (
    TableauPipelineConnection,
)
from metadata.ingestion.source.pipeline.tableaupipeline.models import (
    ExtractTargetType,
    TableauFlowLineage,
    TableauPipelineDetails,
    TableauPipelineKind,
    TableauReferencedQuery,
    TableauRunItem,
)
from metadata.ingestion.source.pipeline.tableaupipeline.queries import (
    TABLEAU_FLOW_LINEAGE_QUERY,
    TABLEAU_METADATA_API_PROBE_QUERY,
    TABLEAU_PUBLISHED_DATASOURCE_ID_QUERY,
    TABLEAU_TABLE_QUERIES_QUERY,
    TABLEAU_WORKBOOK_EXTRACTS_QUERY,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.lru_cache import LRUCache
from metadata.utils.ssl_manager import SSLManager

logger = ingestion_logger()

DEFAULT_NUMBER_OF_STATUS = 10
USER_EMAIL_CACHE_SIZE = 512
PAGE_SIZE = 100
EXTRACT_REFRESH_JOB_TYPES = ["refresh_extracts", "increment_extracts"]
# Only the per-job Query Job call says which data source or workbook a refresh
# job refreshed, so each job costs one request; cap them per ingestion.
MAX_EXTRACT_REFRESH_JOB_LOOKUPS = 1000
# The version TSC keeps when it cannot read the server's; too old for flows.
FALLBACK_API_VERSION = "2.4"


class TableauSiteAdminRequiredError(Exception):
    """Query Jobs answers only server and site administrators."""


class TableauMetadataApiError(Exception):
    """The Metadata API could not be queried at all (as opposed to answering
    with no data)."""


def _has_status(exc: ServerResponseError, status: int) -> bool:
    return str(exc.code).startswith(str(status))


def _join_notes(notes: list[str]) -> str | None:
    return "\n".join(note for note in notes if note) or None


def _started_at(run: TableauRunItem | FlowRunItem) -> float:
    return run.started_at.timestamp() if run.started_at else 0.0


def _retrying_session() -> requests.Session:
    """Tableau throttles with 429 and answers 502-504 while it restarts, and TSC
    does not retry. Every call the connector makes is a read, so POSTs (sign-in,
    Metadata API) are safe to retry too."""
    retry = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=(429, 502, 503, 504),
        allowed_methods=None,
        respect_retry_after_header=True,
        raise_on_status=False,
    )
    session = requests.Session()
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


class TableauPipelineClient:
    """Client for Tableau Prep flows and extract refreshes"""

    def __init__(
        self,
        tableau_server_auth: PersonalAccessTokenAuth | TableauAuth,
        config: TableauPipelineConnection,
        verify_ssl: bool | str | None,
        ssl_manager: SSLManager | None = None,
    ) -> None:
        http_options: dict = {"verify": verify_ssl}
        if ssl_manager and ssl_manager.cert_file_path and ssl_manager.key_file_path:
            http_options["cert"] = (ssl_manager.cert_file_path, ssl_manager.key_file_path)
        # The options go in the constructor: it is where use_server_version reads
        # the server version, and without them that request ignores the SSL config.
        self.tableau_server = Server(
            str(config.hostPort),
            use_server_version=not config.apiVersion,
            http_options=http_options,
            session_factory=_retrying_session,
        )
        if config.apiVersion:
            self.tableau_server.version = config.apiVersion
        elif self.tableau_server.version == FALLBACK_API_VERSION:
            logger.warning(
                "Could not read the REST API version of %s, so REST API %s is used, which cannot list "
                "flows. Set API Version in the connection.",
                config.hostPort,
                FALLBACK_API_VERSION,
            )
        self.tableau_server.auth.sign_in(tableau_server_auth)
        self.config = config
        self.ssl_manager = ssl_manager
        self.number_of_status = config.numberOfStatus or DEFAULT_NUMBER_OF_STATUS
        self._user_emails: LRUCache[str | None] = LRUCache(USER_EMAIL_CACHE_SIZE)
        self._user_lookup_failed = False
        self.extract_refresh_listing_complete = True
        self._extract_targets: frozenset[str] = frozenset()
        # Holds at most MAX_EXTRACT_REFRESH_JOB_LOOKUPS runs, one per looked-up job.
        self._extract_runs: dict[str, list[TableauRunItem]] | None = None

    def get_pipelines(
        self, keep: Callable[[TableauPipelineDetails], bool] = lambda _: True
    ) -> Iterable[TableauPipelineDetails]:
        """All pipelines — Prep flows, then extract refreshes — without run history.

        `keep` is the ingestion's filter; the extract refresh job scan only looks
        for runs of the pipelines it keeps."""
        yield from self._get_flow_pipelines()
        if self.config.includeExtractRefreshes:
            yield from self.get_extract_refresh_pipelines(keep)

    def _get_flow_pipelines(self) -> Iterable[TableauPipelineDetails]:
        flow: FlowItem
        for flow in Pager(self.tableau_server.flows):
            yield TableauPipelineDetails(
                id=str(flow.id),
                name=str(flow.id),
                display_name=flow.name,
                description=flow.description,
                kind=TableauPipelineKind.FLOW,
                project_name=flow.project_name,
                webpage_url=flow.webpage_url,
                owner_id=str(flow.owner_id) if flow.owner_id else None,
                tags=sorted(flow.tags) if flow.tags else [],
            )

    def get_user_email(self, user_id: str) -> str | None:
        """Resolve a Tableau user id to an email address, or None on failure.

        A single owner typically owns many pipelines, so lookups (misses included)
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
            if self._user_lookup_failed:
                logger.debug("Unable to resolve Tableau user %s: %s", user_id, exc)
            else:
                logger.warning(
                    "Unable to resolve Tableau user %s, so its pipelines get no owner: %s. "
                    "Further user lookup failures are logged at debug level.",
                    user_id,
                    exc,
                )
                self._user_lookup_failed = True
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
            runs = self.tableau_server.flow_runs.get(self._flow_runs_options(flow_id, page=1, newest_first=True))
        except ServerResponseError as exc:
            # The Get Flow Runs reference documents the filter but not the sort; a
            # server that rejects it still answers the filter-only request.
            if not _has_status(exc, 400):
                raise
            logger.debug("Tableau rejected sorting flow runs, retrying unsorted: %s", exc)
            runs = heapq.nlargest(self.number_of_status, self._all_flow_runs(flow_id), key=_started_at)

        background_jobs = {str(run.id): run.background_job_id for run in runs}
        items = sorted((self._to_run_item(run) for run in runs), key=_started_at, reverse=True)
        items = items[: self.number_of_status]
        for item in items:
            job_id = background_jobs.get(item.id)
            if item.status == "Failed" and job_id:
                item.error = self._job_notes(job_id)
        return items

    def _all_flow_runs(self, flow_id: str) -> Iterator[FlowRunItem]:
        """Every run of a flow, page by page: unsorted, the newest can be on any page."""
        page = 1
        while True:
            runs = self.tableau_server.flow_runs.get(self._flow_runs_options(flow_id, page, newest_first=False))
            yield from runs
            if len(runs) < PAGE_SIZE:
                return
            page += 1

    def _flow_runs_options(self, flow_id: str, page: int, newest_first: bool) -> RequestOptions:
        page_size = self.number_of_status if newest_first else PAGE_SIZE
        options = RequestOptions(pagenumber=page, pagesize=page_size)
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
            return _join_notes(self.tableau_server.jobs.get_by_id(job_id).notes)
        except Exception as exc:
            logger.debug("Unable to read Tableau job %s: %s", job_id, exc)
            return None

    def get_extract_refresh_pipelines(
        self, keep: Callable[[TableauPipelineDetails], bool] = lambda _: True
    ) -> Iterable[TableauPipelineDetails]:
        """One pipeline per published data source or workbook with an extract
        refresh task. Non-admin users only see the refresh tasks they own.

        Every target is resolved before the first is yielded: the job scan runs
        on the first status request and must know all the kept targets by then.
        A partial listing clears `extract_refresh_listing_complete`, so the source
        does not mark the pipelines it could not list as deleted."""
        self.extract_refresh_listing_complete = True
        self._extract_runs = None
        targets: dict[str, ExtractTargetType] = {}
        try:
            task: TaskItem
            for task in Pager(self.tableau_server.tasks):
                if task.target is not None and task.target.id:
                    targets.setdefault(str(task.target.id), task.target.type)
        except Exception as exc:
            self.extract_refresh_listing_complete = False
            logger.warning("Unable to list Tableau extract refresh tasks: %s", exc)

        pipelines = [
            details
            for target_id, target_type in targets.items()
            if (details := self._extract_refresh_pipeline(target_id, target_type)) is not None
        ]
        self._extract_targets = frozenset(details.id for details in pipelines if keep(details))
        yield from pipelines

    def _extract_refresh_pipeline(
        self, target_id: str, target_type: ExtractTargetType
    ) -> TableauPipelineDetails | None:
        endpoint = self.tableau_server.datasources if target_type == "datasource" else self.tableau_server.workbooks
        try:
            item = endpoint.get_by_id(target_id)
        except Exception as exc:
            if isinstance(exc, ServerResponseError) and _has_status(exc, 404):
                logger.debug("Tableau %s %s has a refresh task but no longer exists", target_type, target_id)
            else:
                self.extract_refresh_listing_complete = False
                logger.warning("Skipping the extract refresh of Tableau %s %s: %s", target_type, target_id, exc)
            return None
        noun = "published data source" if target_type == "datasource" else "workbook"
        return TableauPipelineDetails(
            id=target_id,
            name=target_id,
            display_name=f"{item.name} extract refresh",
            description=f"Refreshes the extract of the {noun} **{item.name}**.",
            kind=TableauPipelineKind.EXTRACT_REFRESH,
            project_name=item.project_name,
            webpage_url=item.webpage_url,
            owner_id=str(item.owner_id) if item.owner_id else None,
            target_type=target_type,
        )

    def get_extract_refresh_runs(self, target_id: str) -> list[TableauRunItem]:
        """Return the most recent `numberOfStatus` refresh jobs of a data source
        or workbook, newest first. The site's job history is read once, on the
        first call, for every target get_extract_refresh_pipelines kept."""
        if self._extract_runs is None:
            self._extract_runs = self._scan_extract_refresh_jobs()
        return self._extract_runs.get(target_id, [])

    def _scan_extract_refresh_jobs(self) -> dict[str, list[TableauRunItem]]:
        """Index recent extract refresh jobs by the data source or workbook they refreshed.

        Query Jobs cannot filter by target, so each job is looked up to learn it.
        Read newest first, the scan stops once every kept target has
        `numberOfStatus` runs; unsorted, it keeps every run and trims afterwards.
        Queued jobs are skipped: they become runs once they start.
        """
        runs: dict[str, list[TableauRunItem]] = {}
        if not self._extract_targets:
            return runs
        full_targets = 0
        lookups = 0
        jobs_without_target = 0
        try:
            for job, newest_first in self._extract_refresh_jobs():
                if newest_first and full_targets == len(self._extract_targets):
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
                target, notes = self._refresh_job_target(job.id)
                if target is None:
                    jobs_without_target += 1
                    continue
                if target not in self._extract_targets:
                    continue
                target_runs = runs.setdefault(target, [])
                if newest_first and len(target_runs) >= self.number_of_status:
                    continue
                target_runs.append(
                    TableauRunItem(
                        id=str(job.id),
                        status=job.status,
                        started_at=job.started_at,
                        completed_at=job.ended_at,
                        error=notes if job.status == "Failed" else None,
                    )
                )
                if newest_first and len(target_runs) == self.number_of_status:
                    full_targets += 1
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
        if lookups and jobs_without_target == lookups:
            logger.warning(
                "Tableau did not say which data source or workbook its refresh jobs refreshed; "
                "extract refresh pipelines are ingested without status."
            )
        return {
            target: sorted(target_runs, key=_started_at, reverse=True)[: self.number_of_status]
            for target, target_runs in runs.items()
        }

    def _refresh_job_target(self, job_id: str) -> tuple[str | None, str | None]:
        """The luid of the data source or workbook a refresh job refreshed, and its notes."""
        try:
            detail = self.tableau_server.jobs.get_by_id(job_id)
        except ServerResponseError as exc:
            if _has_status(exc, 403):
                raise
            logger.debug("Unable to read Tableau job %s: %s", job_id, exc)
            return None, None
        target = detail.datasource_id or detail.workbook_id
        return (str(target) if target else None), _join_notes(detail.notes)

    def _extract_refresh_jobs(self) -> Iterator[tuple[BackgroundJobItem, bool]]:
        """Extract refresh jobs, newest first when the server accepts the sort;
        each comes with whether the listing is sorted."""
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
            for job in jobs:
                yield job, newest_first
            # Query Jobs documents no totalAvailable (TSC reports -1), so a short
            # page is what marks the end.
            if len(jobs) < PAGE_SIZE or 0 <= pagination.total_available <= page * PAGE_SIZE:
                return
            page += 1

    @staticmethod
    def _jobs_options(page: int, newest_first: bool, page_size: int = PAGE_SIZE) -> RequestOptions:
        options = RequestOptions(pagenumber=page, pagesize=page_size)
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

    def get_flow_lineage(self, flow_luid: str) -> TableauFlowLineage | None:
        """Fetch the inputs and outputs of a flow via the Metadata API.

        Returns None when the flow has no lineage records yet (the Metadata store
        lags live publishes by a few minutes on Tableau Server); raises
        TableauMetadataApiError when the Metadata API cannot be queried.
        """
        data = self._metadata_query(TABLEAU_FLOW_LINEAGE_QUERY.format(flow_luid=flow_luid), f"flow {flow_luid}")
        flows = data.get("flows") or []
        if not flows:
            logger.debug("Metadata API returned no flow record for luid=%s", flow_luid)
            return None
        try:
            lineage = TableauFlowLineage.model_validate(flows[0])
        except Exception as exc:
            logger.warning("Unable to parse the Tableau lineage of flow %s: %s", flow_luid, exc)
            return None
        self._attach_custom_sql(lineage)
        return lineage

    def _attach_custom_sql(self, lineage: TableauFlowLineage) -> None:
        """Fetch the custom SQL of the upstream tables Tableau returns without a
        name, the only ones whose lineage is read from it."""
        unnamed = {table.id: table for table in lineage.upstream_tables if not table.name and table.id}
        if not unnamed:
            return
        table_ids = ", ".join(json.dumps(table_id) for table_id in unnamed)
        data = self._metadata_query(
            TABLEAU_TABLE_QUERIES_QUERY.format(table_ids=table_ids), f"custom SQL of {len(unnamed)} tables"
        )
        for table in data.get("databaseTables") or []:
            upstream = unnamed.get(table.get("id"))
            if upstream is not None:
                upstream.referenced_by_queries = [
                    TableauReferencedQuery.model_validate(query) for query in table.get("referencedByQueries") or []
                ]

    def _metadata_query(self, query: str, subject: str) -> dict:
        """The `data` of a Metadata API answer. A node-limit or permission error
        still returns partial data next to `errors`; the data is kept and the
        truncation logged."""
        try:
            result = self.tableau_server.metadata.query(query=query)
        except Exception as exc:
            raise TableauMetadataApiError(f"Tableau Metadata API query failed for {subject}: {exc}") from exc
        if result.get("errors"):
            logger.warning("Tableau Metadata API returned errors for %s: %s", subject, result["errors"])
        return result.get("data") or {}

    def test_get_flows(self) -> list[FlowItem]:
        flows, _ = self.tableau_server.flows.get(RequestOptions(pagesize=1))
        return flows

    def test_get_flow_runs(self) -> list[FlowRunItem]:
        return self.tableau_server.flow_runs.get(RequestOptions(pagesize=1))

    def test_get_extract_refresh_jobs(self) -> list[BackgroundJobItem]:
        """Probe what extract refresh ingestion reads: the refresh tasks, and the
        jobs listing it pages through, which only site administrators can read."""
        self.tableau_server.tasks.get(RequestOptions(pagesize=1))
        try:
            jobs, _ = self.tableau_server.jobs.get(
                job_id=None, req_options=self._jobs_options(page=1, newest_first=True, page_size=1)
            )
        except ServerResponseError as exc:
            if _has_status(exc, 403):
                raise TableauSiteAdminRequiredError(str(exc)) from exc
            raise
        return jobs

    def test_metadata_api(self) -> None:
        """Run a real flow query so a disabled Metadata API or a query the
        server rejects fails here instead of silently yielding no lineage."""
        self.tableau_server.metadata.query(query=TABLEAU_METADATA_API_PROBE_QUERY, abort_on_error=True)

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
