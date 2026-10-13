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
Fixtures for the Tableau dashboard integration test.

Tableau has no container image, so the Tableau site is faked at the HTTP
transport: requests to TABLEAU_HOST are answered from the documented REST and
Metadata API shapes, and everything else, the calls to the server, goes over
the network as usual. tableauserverclient, the connector and the workflow all
run unmodified against a live server.
"""

import json
import re
from collections.abc import Callable, Iterator
from urllib.parse import urlparse

import pytest
import requests
from requests.adapters import HTTPAdapter

from _openmetadata_testutils.ometa import OM_JWT
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.workflow.metadata import MetadataWorkflow

TABLEAU_HOST = "tableau-dashboard-it.example.com"
DASHBOARD_SERVICE = "tableau_dashboard_it"
NS = 'xmlns="http://tableau.com/api"'


def _workbook(workbook_id: str, name: str) -> str:
    return (
        f'<workbook id="{workbook_id}" name="{name}" contentUrl="{name}" '
        f'webpageUrl="https://{TABLEAU_HOST}/#/site/it/workbooks/{workbook_id}">'
        '<project id="p1" name="Finance"/><owner id="owner-1"/></workbook>'
    )


def _view(view_id: str, name: str, content_url: str) -> str:
    return (
        f'<view id="{view_id}" name="{name}" contentUrl="{content_url}" sheetType="worksheet">'
        '<owner id="owner-1"/><usage totalViewCount="3"/></view>'
    )


# `Sales` holds three views that become charts, one the chart filter excludes,
# and one whose content URL the connector cannot parse, so it fails before its
# chart is built. `Ops` holds one view, to show each dashboard only links its
# own charts.
WORKBOOKS = [_workbook("wb-sales", "Sales"), _workbook("wb-ops", "Ops")]
VIEWS = {
    "wb-sales": [
        _view("v-revenue", "Revenue", "Sales/sheets/Revenue"),
        _view("v-orders", "Orders", "Sales/sheets/Orders"),
        _view("v-customers", "Customers", "Sales/sheets/Customers"),
        _view("v-draft", "Draft Revenue", "Sales/sheets/DraftRevenue"),
        _view("v-broken", "Broken", "Sales/Broken"),
    ],
    "wb-ops": [_view("v-incidents", "Incidents", "Ops/sheets/Incidents")],
}


class FakeTableauSite:
    """A Tableau site answering the REST and Metadata API calls the dashboard connector makes."""

    def answer(self, request: requests.PreparedRequest) -> requests.Response:
        path = urlparse(request.url).path
        status, body, content_type = 200, "", "text/xml"
        if path.endswith("/serverInfo"):
            body = (
                f'<tsResponse {NS}><serverInfo><productVersion build="1">2024.2.0</productVersion>'
                "<restApiVersion>3.23</restApiVersion></serverInfo></tsResponse>"
            )
        elif path.endswith("/auth/signin"):
            body = (
                f'<tsResponse {NS}><credentials token="t"><site id="site-it" contentUrl="it"/>'
                '<user id="api-user"/></credentials></tsResponse>'
            )
        elif path.endswith("/auth/signout"):
            status = 204
        elif path.endswith("/projects"):
            body = self._page("projects", ['<project id="p1" name="Finance"/>'])
        elif path.endswith("/workbooks"):
            body = self._page("workbooks", WORKBOOKS)
        elif path.endswith("/views") and "/workbooks/" in path:
            body = self._page("views", VIEWS[path.split("/")[-2]])
        elif path.endswith("/users/owner-1"):
            body = f'<tsResponse {NS}><user id="owner-1" name="admin" email="admin@open-metadata.org"/></tsResponse>'
        elif path.endswith("/api/metadata/graphql"):
            body, content_type = json.dumps(self._graphql(json.loads(request.body)["query"])), "application/json"
        else:
            raise AssertionError(f"Unexpected Tableau call {request.method} {request.url}")

        response = requests.Response()
        response.status_code = status
        response._content = body.encode()
        response.headers["Content-Type"] = content_type
        response.url = request.url
        response.request = request
        return response

    @staticmethod
    def _page(element: str, items: list[str]) -> str:
        return (
            f'<tsResponse {NS}><pagination pageNumber="1" pageSize="100" totalAvailable="{len(items)}"/>'
            f"<{element}>{''.join(items)}</{element}></tsResponse>"
        )

    @staticmethod
    def _graphql(query: str) -> dict:
        if "customSQLTables" in query:
            return {"data": {"customSQLTables": []}}
        luid = re.search(r'luid: "([^"]+)"', query)
        if luid:
            workbook = {
                "id": f"gql-{luid.group(1)}",
                "luid": luid.group(1),
                "name": luid.group(1),
                "embeddedDatasourcesConnection": {"nodes": [], "totalCount": 0},
            }
            return {"data": {"workbooks": [workbook]}}
        return {"data": {}}


@pytest.fixture(scope="module")
def tableau_site() -> Iterator[FakeTableauSite]:
    site = FakeTableauSite()
    original_send = HTTPAdapter.send

    def send(adapter: HTTPAdapter, request: requests.PreparedRequest, **kwargs) -> requests.Response:
        if urlparse(request.url).hostname == TABLEAU_HOST:
            return site.answer(request)
        return original_send(adapter, request, **kwargs)

    with pytest.MonkeyPatch.context() as patcher:
        patcher.setattr(HTTPAdapter, "send", send)
        yield site


def _workflow_config(override_lineage: bool) -> dict:
    return {
        "source": {
            "type": "tableau",
            "serviceName": DASHBOARD_SERVICE,
            "serviceConnection": {
                "config": {
                    "type": "Tableau",
                    "hostPort": f"https://{TABLEAU_HOST}",
                    "siteName": "it",
                    "authType": {"personalAccessTokenName": "pat", "personalAccessTokenSecret": "secret"},
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "DashboardMetadata",
                    "chartFilterPattern": {"excludes": ["^Draft"]},
                    "includeDataModels": False,
                    "overrideLineage": override_lineage,
                }
            },
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "authProvider": "openmetadata",
                "securityConfig": {"jwtToken": OM_JWT},
            }
        },
    }


def _delete_ingested(metadata) -> None:
    service = metadata.get_by_name(entity=DashboardService, fqn=DASHBOARD_SERVICE)
    if service:
        metadata.delete(entity=DashboardService, entity_id=service.id, recursive=True, hard_delete=True)


@pytest.fixture(scope="module")
def ingest(metadata, run_workflow, tableau_site) -> Iterator[Callable[..., MetadataWorkflow]]:
    """Runs the workflow and hands it back. The broken view is a source failure on
    every run, so the status is asserted by the tests instead of raised here."""
    _delete_ingested(metadata)

    def _ingest(override_lineage: bool = False) -> MetadataWorkflow:
        return run_workflow(MetadataWorkflow, _workflow_config(override_lineage), raise_from_status=False)

    try:
        yield _ingest
    finally:
        _delete_ingested(metadata)


@pytest.fixture(scope="module")
def first_run(ingest) -> MetadataWorkflow:
    return ingest()
