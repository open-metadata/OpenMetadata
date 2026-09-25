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
TableauPipelineClient against a fake Tableau at the HTTP transport.

Only ``HTTPAdapter.send`` is replaced, so tableauserverclient builds every
request, parses every XML body and drives ``Pager`` exactly as it would against
a real server. Bodies follow the REST and Metadata API reference examples.
"""

import json
import logging
from urllib.parse import parse_qs, urlparse

import pytest
import requests
from requests.adapters import HTTPAdapter
from tableauserverclient import PersonalAccessTokenAuth
from tableauserverclient.server.endpoint.exceptions import (
    GraphQLError,
    ServerResponseError,
)

from metadata.generated.schema.entity.services.connections.pipeline.tableauPipelineConnection import (
    TableauPipelineConnection,
)
from metadata.ingestion.source.pipeline.tableaupipeline import client as client_module
from metadata.ingestion.source.pipeline.tableaupipeline.client import (
    TableauPipelineClient,
    TableauSiteAdminRequiredError,
)

HOST = "https://tableau.example.com"
SITE_ID = "site-luid"
NS = 'xmlns="http://tableau.com/api"'

SERVER_INFO = f"""<tsResponse {NS}><serverInfo>
<productVersion build="20241.24.0312.0830">2024.1.0</productVersion>
<restApiVersion>3.22</restApiVersion></serverInfo></tsResponse>"""

SIGN_IN = f"""<tsResponse {NS}><credentials token="token">
<site id="{SITE_ID}" contentUrl="MarketingTeam"/><user id="api-user"/></credentials></tsResponse>"""


def _flow_xml(flow_id: str, name: str) -> str:
    return (
        f'<flow id="{flow_id}" name="{name}" description="{name} flow" '
        f'webpageUrl="{HOST}/#/site/MarketingTeam/flows/{flow_id}" '
        'createdAt="2025-01-01T00:00:00Z" updatedAt="2025-01-02T00:00:00Z">'
        '<project id="project-1" name="Finance"/><owner id="owner-1"/>'
        '<tags><tag label="pii"/><tag label="finance"/></tags></flow>'
    )


def _flows_page(page: int, total: int, flows: list[str]) -> str:
    return (
        f'<tsResponse {NS}><pagination pageNumber="{page}" pageSize="1" totalAvailable="{total}"/>'
        f"<flows>{''.join(flows)}</flows></tsResponse>"
    )


def _run_xml(run_id: str, started: str, status: str = "Success") -> str:
    return (
        f'<flowRuns id="{run_id}" flowId="flow-1" status="{status}" startedAt="{started}" '
        f'completedAt="{started.replace(":00Z", ":05Z")}" progress="100" backgroundJobId="job-{run_id}"/>'
    )


def _runs(*runs: str) -> str:
    return (
        f'<tsResponse {NS}><pagination pageNumber="1" pageSize="100" totalAvailable="{len(runs)}"/>'
        f"<flowRuns>{''.join(runs)}</flowRuns></tsResponse>"
    )


def _error(code: str) -> str:
    return (
        f'<tsResponse {NS}><error code="{code}"><summary>Bad Request</summary>'
        "<detail>sort is not supported</detail></error></tsResponse>"
    )


def _task_xml(task_id: str, target_type: str, target_id: str) -> str:
    return (
        f'<task><extractRefresh id="{task_id}" priority="50" consecutiveFailedCount="0" type="RefreshExtractTask">'
        '<schedule frequency="Daily" nextRunAt="2025-03-04T06:00:00Z"><frequencyDetails start="06:00:00"/></schedule>'
        f'<{target_type} id="{target_id}"/></extractRefresh></task>'
    )


def _content_xml(kind: str, content_id: str, name: str) -> str:
    return (
        f'<tsResponse {NS}><{kind} id="{content_id}" name="{name}" '
        f'webpageUrl="{HOST}/#/site/MarketingTeam/{kind}s/{content_id}">'
        f'<project id="project-1" name="Finance"/><owner id="owner-9"/><tags/></{kind}></tsResponse>'
    )


def _background_job_xml(job_id: str, created: str, status: str = "Success", started: bool = True) -> str:
    times = f'startedAt="{created}" endedAt="{created.replace(":00Z", ":09Z")}"' if started else ""
    return (
        f'<backgroundJob id="{job_id}" status="{status}" createdAt="{created}" {times} '
        'priority="50" jobType="refresh_extracts"/>'
    )


def _job_detail_xml(job_id: str, target_type: str, target_id: str, notes: str = "") -> str:
    return (
        f'<tsResponse {NS}><job id="{job_id}" mode="Asynchronous" type="RefreshExtract" progress="100" '
        f'finishCode="0"><extractRefreshJob><notes>{notes}</notes>'
        f'<{target_type} id="{target_id}" name="n"/></extractRefreshJob></job></tsResponse>'
    )


class FakeTableau:
    """Answers TSC's HTTP calls from canned bodies and records every request."""

    def __init__(self):
        self.requests: list[requests.PreparedRequest] = []
        self.flow_pages = [
            _flows_page(1, 2, [_flow_xml("flow-1", "Sales")]),
            _flows_page(2, 2, [_flow_xml("flow-2", "Ops")]),
        ]
        self.runs_response: tuple[int, str] = (200, _runs())
        self.unsorted_runs_response: tuple[int, str] | None = None
        self.users: dict[str, str] = {}
        self.graphql_response: dict = {"data": {"flows": []}}
        self.tasks: list[str] = []
        self.content: dict[str, str] = {}
        self.jobs: list[str] = []
        self.jobs_status = 200
        self.job_details: dict[str, str] = {}

    def send(self, request: requests.PreparedRequest, **_kwargs) -> requests.Response:
        self.requests.append(request)
        path = urlparse(request.url).path
        query = parse_qs(urlparse(request.url).query)
        status, body, content_type = 200, "", "text/xml"
        if path.endswith("/serverInfo"):
            body = SERVER_INFO
        elif path.endswith("/auth/signin"):
            body = SIGN_IN
        elif path.endswith("/auth/signout"):
            status = 204
        elif path.endswith("/flows/runs"):
            status, body = (
                self.unsorted_runs_response
                if "sort" not in query and self.unsorted_runs_response
                else self.runs_response
            )
        elif path.endswith("/flows"):
            body = self.flow_pages[int(query.get("pageNumber", ["1"])[0]) - 1]
        elif "/users/" in path:
            body = self.users[path.rsplit("/", 1)[-1]]
        elif path.endswith("/tasks/extractRefreshes"):
            body = (
                f'<tsResponse {NS}><pagination pageNumber="1" pageSize="100" totalAvailable="{len(self.tasks)}"/>'
                f"<tasks>{''.join(self.tasks)}</tasks></tsResponse>"
            )
        elif "/datasources/" in path or "/workbooks/" in path:
            content_id = path.rsplit("/", 1)[-1]
            status, body = (200, self.content[content_id]) if content_id in self.content else (404, _error("404004"))
        elif path.endswith("/jobs"):
            status, body = self.jobs_status, self._jobs_page(query)
        elif "/jobs/" in path:
            body = self.job_details[path.rsplit("/", 1)[-1]]
        elif path.endswith("/api/metadata/graphql"):
            body, content_type = json.dumps(self.graphql_response), "application/json"
        else:
            raise AssertionError(f"Unexpected Tableau call {request.method} {request.url}")

        response = requests.Response()
        response.status_code = status
        response._content = body.encode()
        response.headers["Content-Type"] = content_type
        response.url = request.url
        response.request = request
        return response

    def _jobs_page(self, query: dict) -> str:
        if self.jobs_status != 200:
            return _error(f"{self.jobs_status}004")
        page, size = int(query.get("pageNumber", ["1"])[0]), int(query["pageSize"][0])
        jobs = self.jobs[(page - 1) * size : page * size]
        return (
            f'<tsResponse {NS}><pagination pageNumber="{page}" pageSize="{size}" totalAvailable="{len(self.jobs)}"/>'
            f"<backgroundJobs>{''.join(jobs)}</backgroundJobs></tsResponse>"
        )

    def calls_to(self, suffix: str) -> list[requests.PreparedRequest]:
        return [r for r in self.requests if urlparse(r.url).path.endswith(suffix)]


@pytest.fixture
def tableau(monkeypatch):
    fake = FakeTableau()
    monkeypatch.setattr(HTTPAdapter, "send", fake.send)
    return fake


def _client(number_of_status: int = 2, include_extract_refreshes: bool = True) -> TableauPipelineClient:
    config = TableauPipelineConnection(
        hostPort=HOST,
        authType={"personalAccessTokenName": "pat", "personalAccessTokenSecret": "secret"},
        siteName="MarketingTeam",
        numberOfStatus=number_of_status,
        includeExtractRefreshes=include_extract_refreshes,
    )
    return TableauPipelineClient(
        tableau_server_auth=PersonalAccessTokenAuth("pat", "secret", site_id="MarketingTeam"),
        config=config,
        verify_ssl=True,
    )


class TestFlows:
    def test_pages_through_every_flow(self, tableau):
        flows = list(_client().get_flows())

        assert [flow.id for flow in flows] == ["flow-1", "flow-2"]
        assert len(tableau.calls_to("/flows")) == 2
        sales = flows[0]
        assert sales.name == "Sales"
        assert sales.project_name == "Finance"
        assert sales.owner_id == "owner-1"
        assert sales.tags == ["finance", "pii"]
        assert sales.webpage_url == f"{HOST}/#/site/MarketingTeam/flows/flow-1"

    def test_pipelines_are_named_after_the_flow_id(self, tableau):
        pipelines = list(_client().get_pipelines())

        assert [(p.name, p.display_name) for p in pipelines] == [("flow-1", "Sales"), ("flow-2", "Ops")]


class TestFlowRuns:
    def test_requests_the_newest_runs_of_one_flow(self, tableau):
        tableau.runs_response = (
            200,
            _runs(_run_xml("run-new", "2025-03-02T10:00:00Z"), _run_xml("run-old", "2025-03-01T10:00:00Z")),
        )

        runs = _client(number_of_status=2).get_flow_runs("flow-1")

        query = parse_qs(urlparse(tableau.calls_to("/flows/runs")[0].url).query)
        assert query["filter"] == ["flowId:eq:flow-1"]
        assert query["sort"] == ["startedAt:desc"]
        assert query["pageSize"] == ["2"]
        assert [run.id for run in runs] == ["run-new", "run-old"]
        assert runs[0].status == "Success"
        assert runs[0].error is None
        assert runs[0].started_at.isoformat() == "2025-03-02T10:00:00+00:00"
        assert runs[0].completed_at.isoformat() == "2025-03-02T10:00:05+00:00"

    def test_orders_newest_first_and_caps_even_if_the_server_does_not(self, tableau):
        tableau.runs_response = (
            200,
            _runs(
                _run_xml("run-1", "2025-03-01T10:00:00Z"),
                _run_xml("run-3", "2025-03-03T10:00:00Z"),
                _run_xml("run-2", "2025-03-02T10:00:00Z"),
            ),
        )

        runs = _client(number_of_status=2).get_flow_runs("flow-1")

        assert [run.id for run in runs] == ["run-3", "run-2"]

    def test_retries_unsorted_when_the_server_rejects_the_sort(self, tableau):
        tableau.runs_response = (400, _error("400006"))
        tableau.unsorted_runs_response = (
            200,
            _runs(_run_xml("run-1", "2025-03-01T10:00:00Z"), _run_xml("run-2", "2025-03-02T10:00:00Z")),
        )

        runs = _client(number_of_status=5).get_flow_runs("flow-1")

        retry = parse_qs(urlparse(tableau.calls_to("/flows/runs")[1].url).query)
        assert retry["filter"] == ["flowId:eq:flow-1"]
        assert "sort" not in retry
        assert [run.id for run in runs] == ["run-2", "run-1"]

    def test_a_failed_run_carries_the_notes_of_its_job(self, tableau):
        tableau.runs_response = (200, _runs(_run_xml("run-1", "2025-03-01T10:00:00Z", status="Failed")))
        tableau.job_details["job-run-1"] = _job_detail_xml("job-run-1", "datasource", "x", notes="Output step failed")

        runs = _client().get_flow_runs("flow-1")

        assert runs[0].error == "Output step failed"

    def test_other_errors_propagate(self, tableau):
        tableau.runs_response = (403, _error("403004"))

        with pytest.raises(ServerResponseError):
            _client().get_flow_runs("flow-1")
        assert len(tableau.calls_to("/flows/runs")) == 1

    def test_connection_probe_returns_the_runs_it_read(self, tableau):
        tableau.runs_response = (200, _runs(_run_xml("run-1", "2025-03-01T10:00:00Z")))

        runs = _client().test_get_flow_runs()

        assert len(runs) == 1
        assert parse_qs(urlparse(tableau.calls_to("/flows/runs")[0].url).query)["pageSize"] == ["1"]


def _user(user_id: str, name: str, email: str | None) -> str:
    email_attr = f' email="{email}"' if email else ""
    return f'<tsResponse {NS}><user id="{user_id}" name="{name}" siteRole="Viewer"{email_attr}/></tsResponse>'


class TestUserEmail:
    def test_hits_and_misses_are_cached(self, tableau):
        tableau.users["owner-1"] = _user("owner-1", "alice", "alice@example.com")
        tableau.users["owner-2"] = _user("owner-2", "bob", None)
        client = _client()

        assert client.get_user_email("owner-1") == "alice@example.com"
        assert client.get_user_email("owner-1") == "alice@example.com"
        assert client.get_user_email("owner-2") is None
        assert client.get_user_email("owner-2") is None
        assert len([r for r in tableau.requests if "/users/" in r.url]) == 2

    def test_email_shaped_username_is_used_when_email_is_empty(self, tableau):
        tableau.users["owner-1"] = _user("owner-1", "carol@example.com", None)

        assert _client().get_user_email("owner-1") == "carol@example.com"


LINEAGE = {
    "id": "gql-flow-1",
    "luid": "flow-1",
    "name": "Sales",
    "upstreamTables": [
        {
            "id": "gql-orders",
            "luid": "orders-luid",
            "name": "orders",
            "fullName": "[public].[orders]",
            "schema": "public",
            "database": {"name": "sales_db", "connectionType": "postgres"},
            "referencedByQueries": [],
        }
    ],
    "upstreamDatasources": [{"id": "gql-ds-in", "luid": "ds-in", "name": "Targets", "projectName": "Finance"}],
    "outputSteps": [{"id": "step-1", "name": "Output"}],
    "downstreamTables": [
        {
            "id": "gql-sales",
            "luid": "sales-luid",
            "name": "sales_clean",
            "fullName": "[analytics].[sales_clean]",
            "schema": "analytics",
            "database": {"name": "warehouse", "connectionType": "snowflake"},
        }
    ],
    "downstreamDatasources": [{"id": "gql-ds-out", "luid": "ds-out", "name": "Sales Clean", "projectName": "Finance"}],
    "nextDownstreamFlows": [{"id": "gql-flow-2", "luid": "flow-2", "name": "Ops"}],
}


class TestFlowLineage:
    def test_parses_inputs_and_outputs_of_the_flow(self, tableau):
        tableau.graphql_response = {"data": {"flows": [LINEAGE]}}

        lineage = _client().get_flow_lineage("flow-1")

        sent = json.loads(tableau.calls_to("/api/metadata/graphql")[0].body)["query"]
        assert 'flows(filter: {luid: "flow-1"})' in sent
        assert lineage.upstream_tables[0].database.connection_type == "postgres"
        assert lineage.upstream_datasources[0].id == "gql-ds-in"
        assert lineage.downstream_tables[0].schema_ == "analytics"
        assert lineage.downstream_datasources[0].project_name == "Finance"
        assert lineage.next_downstream_flows[0].luid == "flow-2"
        assert lineage.output_steps[0].name == "Output"

    def test_keeps_partial_data_and_logs_the_errors(self, tableau, caplog):
        tableau.graphql_response = {
            "data": {"flows": [LINEAGE]},
            "errors": [{"message": "Showing partial results. The request exceeded the 20000 node limit"}],
        }

        with caplog.at_level(logging.WARNING):
            lineage = _client().get_flow_lineage("flow-1")

        assert lineage is not None
        assert "20000 node limit" in caplog.text

    def test_a_rejected_query_yields_no_lineage(self, tableau, caplog):
        tableau.graphql_response = {"errors": [{"message": "Validation error of type FieldUndefined"}]}

        with caplog.at_level(logging.WARNING):
            assert _client().get_flow_lineage("flow-1") is None
        assert "FieldUndefined" in caplog.text

    def test_unknown_flow_yields_no_lineage(self, tableau):
        tableau.graphql_response = {"data": {"flows": []}}

        assert _client().get_flow_lineage("flow-1") is None

    def test_probe_fails_on_graphql_errors(self, tableau):
        tableau.graphql_response = {"errors": [{"message": "Metadata API is disabled"}]}

        with pytest.raises(GraphQLError):
            _client().test_metadata_api()

    def test_probe_passes_on_a_valid_answer(self, tableau):
        tableau.graphql_response = {"data": {"flowsConnection": {"nodes": []}}}

        _client().test_metadata_api()


class TestLifecycle:
    def test_sign_out_releases_the_session(self, tableau):
        client = _client()

        client.sign_out()

        assert len(tableau.calls_to("/auth/signout")) == 1


class TestExtractRefreshes:
    def _two_targets(self, tableau):
        tableau.tasks = [
            _task_xml("task-full", "datasource", "ds-1"),
            _task_xml("task-incremental", "datasource", "ds-1"),
            _task_xml("task-wb", "workbook", "wb-1"),
        ]
        tableau.content = {
            "ds-1": _content_xml("datasource", "ds-1", "Sales"),
            "wb-1": _content_xml("workbook", "wb-1", "Exec"),
        }

    def test_each_refreshed_datasource_or_workbook_is_one_pipeline(self, tableau):
        self._two_targets(tableau)
        tableau.tasks.append(_task_xml("task-orphan", "datasource", "ds-deleted"))

        pipelines = list(_client().get_pipelines())

        extracts = [p for p in pipelines if p.pipeline_type.value == "extractRefresh"]
        assert [(p.name, p.target_type, p.display_name) for p in extracts] == [
            ("ds-1", "datasource", "Sales extract refresh"),
            ("wb-1", "workbook", "Exec extract refresh"),
        ]
        assert extracts[0].owner_id == "owner-9"
        assert extracts[0].webpage_url == f"{HOST}/#/site/MarketingTeam/datasources/ds-1"
        assert "published data source **Sales**" in extracts[0].description

    def test_turned_off_lists_only_flows(self, tableau):
        self._two_targets(tableau)

        pipelines = list(_client(include_extract_refreshes=False).get_pipelines())

        assert [p.name for p in pipelines] == ["flow-1", "flow-2"]
        assert tableau.calls_to("/tasks/extractRefreshes") == []

    def test_jobs_are_matched_to_their_target_newest_first(self, tableau):
        self._two_targets(tableau)
        tableau.jobs = [
            _background_job_xml("j5", "2025-03-05T06:00:00Z", status="Pending", started=False),
            _background_job_xml("j4", "2025-03-04T06:00:00Z"),
            _background_job_xml("j3", "2025-03-03T06:00:00Z", status="Failed"),
            _background_job_xml("j2", "2025-03-02T06:00:00Z", status="Failed"),
            _background_job_xml("j1", "2025-03-01T06:00:00Z"),
        ]
        tableau.job_details = {
            "j4": _job_detail_xml("j4", "datasource", "ds-1"),
            "j3": _job_detail_xml("j3", "workbook", "wb-1", notes="Unable to connect to the server"),
            "j2": _job_detail_xml("j2", "datasource", "ds-1", notes="Login failed"),
            "j1": _job_detail_xml("j1", "datasource", "ds-1"),
        }
        client = _client(number_of_status=2)
        list(client.get_pipelines())

        sales = client.get_extract_refresh_runs("ds-1")
        exec_runs = client.get_extract_refresh_runs("wb-1")

        query = parse_qs(urlparse(tableau.calls_to("/jobs")[0].url).query)
        assert query["filter"] == ["jobType:in:[refresh_extracts,increment_extracts]"]
        assert query["sort"] == ["createdAt:desc"]
        assert [(run.id, run.status, run.error) for run in sales] == [
            ("j4", "Success", None),
            ("j2", "Failed", "Login failed"),
        ]
        assert [(run.id, run.error) for run in exec_runs] == [("j3", "Unable to connect to the server")]
        assert sales[0].completed_at.isoformat() == "2025-03-04T06:00:09+00:00"
        assert len(tableau.calls_to("/jobs")) == 1
        assert [r for r in tableau.requests if r.url.endswith("/jobs/j5")] == []

    def test_stops_reading_jobs_once_every_target_is_full(self, tableau):
        self._two_targets(tableau)
        tableau.jobs = [
            _background_job_xml("j3", "2025-03-03T06:00:00Z"),
            _background_job_xml("j2", "2025-03-02T06:00:00Z"),
            _background_job_xml("j1", "2025-03-01T06:00:00Z"),
        ]
        tableau.job_details = {
            "j3": _job_detail_xml("j3", "datasource", "ds-1"),
            "j2": _job_detail_xml("j2", "workbook", "wb-1"),
            "j1": _job_detail_xml("j1", "datasource", "ds-1"),
        }
        client = _client(number_of_status=1)
        list(client.get_pipelines())

        assert [run.id for run in client.get_extract_refresh_runs("ds-1")] == ["j3"]
        assert [r for r in tableau.requests if r.url.endswith("/jobs/j1")] == []

    def test_job_lookups_are_capped(self, tableau, monkeypatch, caplog):
        monkeypatch.setattr(client_module, "MAX_EXTRACT_REFRESH_JOB_LOOKUPS", 2)
        self._two_targets(tableau)
        tableau.jobs = [_background_job_xml(f"j{i}", f"2025-03-0{i}T06:00:00Z") for i in range(5, 0, -1)]
        tableau.job_details = {f"j{i}": _job_detail_xml(f"j{i}", "datasource", "ds-1") for i in range(1, 6)}
        client = _client(number_of_status=5)
        list(client.get_pipelines())

        with caplog.at_level(logging.WARNING):
            runs = client.get_extract_refresh_runs("ds-1")

        assert [run.id for run in runs] == ["j5", "j4"]
        assert "older refreshes are not ingested" in caplog.text

    def test_a_non_admin_gets_pipelines_without_status(self, tableau, caplog):
        self._two_targets(tableau)
        tableau.jobs_status = 403
        client = _client()
        list(client.get_pipelines())

        with caplog.at_level(logging.WARNING):
            assert client.get_extract_refresh_runs("ds-1") == []
        assert "needs a site administrator" in caplog.text

    def test_probe_names_the_site_admin_requirement(self, tableau):
        tableau.jobs_status = 403

        with pytest.raises(TableauSiteAdminRequiredError):
            _client().test_get_extract_refresh_jobs()

    def test_refreshed_datasource_ids(self, tableau):
        client = _client()
        tableau.graphql_response = {"data": {"publishedDatasources": [{"id": "gql-ds-1"}]}}
        assert client.get_extract_datasource_ids("datasource", "ds-1") == ["gql-ds-1"]

        tableau.graphql_response = {
            "data": {
                "workbooks": [
                    {
                        "embeddedDatasources": [
                            {"id": "gql-extract", "hasExtracts": True},
                            {"id": "gql-live", "hasExtracts": False},
                        ]
                    }
                ]
            }
        }
        assert client.get_extract_datasource_ids("workbook", "wb-1") == ["gql-extract"]
        sent = json.loads(tableau.calls_to("/api/metadata/graphql")[-1].body)["query"]
        assert 'workbooks(filter: {luid: "wb-1"})' in sent
