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
Fixtures for the Tableau Pipeline integration test.

Tableau has no container image, so the Tableau site is faked at the HTTP
transport: requests to TABLEAU_HOST are answered from the documented REST and
Metadata API shapes, and everything else — the OpenMetadata server — goes over
the network as usual. tableauserverclient, the connector and the workflow all
run unmodified against a live OpenMetadata server.
"""

import json
import re
from collections.abc import Iterator
from urllib.parse import parse_qs, urlparse

import pytest
import requests
from requests.adapters import HTTPAdapter

from _openmetadata_testutils.ometa import OM_JWT
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.workflow.metadata import MetadataWorkflow

TABLEAU_HOST = "tableau-it.example.com"
PIPELINE_SERVICE = "tableau_pipeline_it"
DB_SERVICE = "tableau_pipeline_it_warehouse"
NS = 'xmlns="http://tableau.com/api"'


def _flow(flow_id: str, name: str, tags: str = "") -> str:
    return (
        f'<flow id="{flow_id}" name="{name}" description="{name} flow" '
        f'webpageUrl="https://{TABLEAU_HOST}/#/site/it/flows/{flow_id}">'
        f'<project id="p1" name="Finance"/><owner id="owner-1"/><tags>{tags}</tags></flow>'
    )


def _flow_run(run_id: str, flow_id: str, status: str, started: str, completed: str) -> str:
    return (
        f'<flowRuns id="{run_id}" flowId="{flow_id}" status="{status}" startedAt="{started}" '
        f'completedAt="{completed}" progress="100" backgroundJobId="bg-{run_id}"/>'
    )


def _background_job(job_id: str, status: str, started: str, ended: str) -> str:
    return (
        f'<backgroundJob id="{job_id}" status="{status}" createdAt="{started}" startedAt="{started}" '
        f'endedAt="{ended}" priority="50" jobType="refresh_extracts"/>'
    )


def _job(job_id: str, notes: str, target: str = "") -> str:
    return (
        f'<tsResponse {NS}><job id="{job_id}" mode="Asynchronous" type="RefreshExtract" finishCode="0">'
        f"<extractRefreshJob><notes>{notes}</notes>{target}</extractRefreshJob></job></tsResponse>"
    )


def _table(table_id: str, name: str) -> dict:
    return {
        "id": table_id,
        "name": name,
        "fullName": f"[public].[{name}]",
        "schema": "public",
        "database": {"name": "warehouse", "connectionType": "mysql"},
    }


# A Prep flow `Sales` reads warehouse.public.orders and writes
# warehouse.public.sales_clean, which the flow `Ops` reads next. `Sales` is
# listed first, so its edge to `Ops` can only be drawn after `Ops` is ingested.
FLOW_LINEAGE = {
    "flow-sales": {
        "upstreamTables": [_table("t-orders", "orders")],
        "upstreamDatasources": [],
        "outputSteps": [{"id": "out-clean", "name": "Clean sales"}],
        "downstreamTables": [_table("t-sales-clean", "sales_clean")],
        "downstreamDatasources": [],
        "nextDownstreamFlows": [{"luid": "flow-ops", "name": "Ops"}],
    },
    "flow-ops": {
        "upstreamTables": [_table("t-sales-clean", "sales_clean")],
        "upstreamDatasources": [],
        "outputSteps": [],
        "downstreamTables": [],
        "downstreamDatasources": [],
        "nextDownstreamFlows": [],
    },
}


class FakeTableauSite:
    """A Tableau site answering the REST and Metadata API calls the connector makes."""

    def __init__(self):
        self.flows = [_flow("flow-sales", "Sales", tags='<tag label="finance"/>'), _flow("flow-ops", "Ops")]
        self.flow_runs = {
            "flow-sales": [
                _flow_run("run-2", "flow-sales", "Failed", "2026-09-02T06:00:00Z", "2026-09-02T06:01:30Z"),
                _flow_run("run-1", "flow-sales", "Success", "2026-09-01T06:00:00Z", "2026-09-01T06:04:10Z"),
            ],
            "flow-ops": [],
        }
        self.jobs = [
            _background_job("job-2", "Failed", "2026-09-02T07:00:00Z", "2026-09-02T07:00:40Z"),
            _background_job("job-1", "Success", "2026-09-01T07:00:00Z", "2026-09-01T07:03:00Z"),
        ]
        target = '<datasource id="ds-sales" name="Sales Extract"/>'
        self.job_details = {
            "job-2": _job("job-2", "Unable to connect to the server warehouse.example.com", target),
            "job-1": _job("job-1", "", target),
            "bg-run-2": _job("bg-run-2", "Output step Clean sales failed: table is locked"),
        }

    def answer(self, request: requests.PreparedRequest) -> requests.Response:
        path = urlparse(request.url).path
        query = parse_qs(urlparse(request.url).query)
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
        elif path.endswith("/flows/runs"):
            flow_id = query["filter"][0].split(":")[-1]
            body = self._page("flowRuns", self.flow_runs.get(flow_id, []))
        elif path.endswith("/flows"):
            body = self._page("flows", self.flows)
        elif path.endswith("/users/owner-1"):
            body = f'<tsResponse {NS}><user id="owner-1" name="admin" email="admin@open-metadata.org"/></tsResponse>'
        elif path.endswith("/tasks/extractRefreshes"):
            body = self._page(
                "tasks",
                [
                    '<task><extractRefresh id="task-1" priority="50" consecutiveFailedCount="1" '
                    'type="RefreshExtractTask"><schedule frequency="Daily" nextRunAt="2026-09-03T07:00:00Z">'
                    '<frequencyDetails start="07:00:00"/></schedule><datasource id="ds-sales"/>'
                    "</extractRefresh></task>"
                ],
            )
        elif path.endswith("/datasources/ds-sales"):
            body = (
                f'<tsResponse {NS}><datasource id="ds-sales" name="Sales Extract" '
                f'webpageUrl="https://{TABLEAU_HOST}/#/site/it/datasources/ds-sales">'
                '<project id="p1" name="Finance"/><owner id="owner-1"/></datasource></tsResponse>'
            )
        elif path.endswith("/jobs"):
            body = self._page("backgroundJobs", self.jobs)
        elif "/jobs/" in path:
            body = self.job_details[path.rsplit("/", 1)[-1]]
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
        luid = re.search(r'luid: "([^"]+)"', query)
        if "flowsConnection" in query:
            return {"data": {"flowsConnection": {"nodes": [{"id": "gql-flow-sales"}]}}}
        if "publishedDatasources" in query:
            return {"data": {"publishedDatasources": [{"id": "gql-ds-sales"}]}}
        if "flows(filter" in query and luid:
            lineage = FLOW_LINEAGE.get(luid.group(1))
            return {"data": {"flows": [lineage] if lineage else []}}
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


@pytest.fixture(scope="module")
def warehouse_tables(metadata) -> Iterator[dict[str, Table]]:
    service = metadata.create_or_update(
        CreateDatabaseServiceRequest(
            name=DB_SERVICE,
            serviceType=DatabaseServiceType.Mysql,
            connection=DatabaseConnection(
                config=MysqlConnection(username="u", authType=BasicAuth(password="p"), hostPort="localhost:3306")
            ),
        )
    )
    database = metadata.create_or_update(CreateDatabaseRequest(name="warehouse", service=service.fullyQualifiedName))
    schema = metadata.create_or_update(CreateDatabaseSchemaRequest(name="public", database=database.fullyQualifiedName))
    tables = {
        name: metadata.create_or_update(
            CreateTableRequest(
                name=name,
                databaseSchema=schema.fullyQualifiedName,
                columns=[Column(name="id", dataType=DataType.INT)],
            )
        )
        for name in ("orders", "sales_clean")
    }
    yield tables
    metadata.delete(entity=DatabaseService, entity_id=service.id, recursive=True, hard_delete=True)


@pytest.fixture(scope="module")
def workflow_config() -> dict:
    return {
        "source": {
            "type": "tableaupipeline",
            "serviceName": PIPELINE_SERVICE,
            "serviceConnection": {
                "config": {
                    "type": "TableauPipeline",
                    "hostPort": f"https://{TABLEAU_HOST}",
                    "siteName": "it",
                    "authType": {"personalAccessTokenName": "pat", "personalAccessTokenSecret": "secret"},
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "PipelineMetadata",
                    "lineageInformation": {"dbServiceNames": [DB_SERVICE]},
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
    service = metadata.get_by_name(entity=PipelineService, fqn=PIPELINE_SERVICE)
    if service:
        metadata.delete(entity=PipelineService, entity_id=service.id, recursive=True, hard_delete=True)
    classification = metadata.get_by_name(entity=Classification, fqn="TableauTags")
    if classification:
        metadata.delete(entity=Classification, entity_id=classification.id, recursive=True, hard_delete=True)


@pytest.fixture(scope="module")
def ingested(metadata, run_workflow, tableau_site, warehouse_tables, workflow_config) -> Iterator[None]:
    _delete_ingested(metadata)
    try:
        run_workflow(MetadataWorkflow, workflow_config)
        yield
    finally:
        _delete_ingested(metadata)
