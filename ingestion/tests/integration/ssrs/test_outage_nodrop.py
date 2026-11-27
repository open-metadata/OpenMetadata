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
End-to-end regression for ADR:2026-11-25-an-ssrs-run-that-could-not-read-every-report-deletes-nothing-stale:
an SSRS outage mid-run must not soft-delete what an earlier run ingested. Requires a live
OpenMetadata server at http://localhost:8585.
"""

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

import pytest

from _openmetadata_testutils.ometa import OM_JWT
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.ingestion.source.dashboard.ssrs import client as ssrs_client
from metadata.workflow.metadata import MetadataWorkflow

REPORTS = [
    {
        "Id": report_id,
        "Name": name,
        "Path": f"/Folder/{name}",
        "Type": "Report",
        "Hidden": False,
        "HasDataSources": True,
    }
    for report_id, name in (("report-ok", "OK Report"), ("report-outage", "Outage Report"))
]
ALL_REPORT_IDS = tuple(report["Id"] for report in REPORTS)

RDL = (
    b'<?xml version="1.0" encoding="utf-8"?>'
    b'<Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition">'
    b"<DataSources>"
    b'<DataSource Name="MainDS">'
    b"<ConnectionProperties>"
    b"<DataProvider>SQL</DataProvider>"
    b"<ConnectString>Data Source=sql01;Initial Catalog=SalesDB</ConnectString>"
    b"</ConnectionProperties></DataSource>"
    b"</DataSources>"
    b"<DataSets>"
    b'<DataSet Name="Orders">'
    b"<Query><DataSourceName>MainDS</DataSourceName>"
    b"<CommandType>Text</CommandType>"
    b"<CommandText>SELECT OrderId FROM dbo.Orders</CommandText></Query>"
    b'<Fields><Field Name="OrderId"><DataField>OrderId</DataField></Field></Fields></DataSet>'
    b"</DataSets></Report>"
)

RDL_PATHS = (
    "/reports/api/v2.0/Reports({id})/Content/$value",
    "/reports/api/v2.0/CatalogItems({id})/Content",
)


class MockSsrsHandler(BaseHTTPRequestHandler):
    """Each test sets which reports exist, which report definitions fail, and whether every
    /Reports page after the first fails."""

    report_ids: tuple[str, ...] = ALL_REPORT_IDS
    failing_rdl_ids: frozenset[str] = frozenset()
    fail_later_report_pages = False

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        skip = int(params.get("$skip", ["0"])[0])
        top = int(params.get("$top", ["100"])[0])
        if parsed.path == "/reports/api/v2.0/Folders":
            self._respond({"value": [{"Id": "folder-1", "Name": "Folder", "Path": "/Folder"}][skip : skip + top]})
        elif parsed.path == "/reports/api/v2.0/Reports":
            if skip and self.fail_later_report_pages:
                self.send_error(500, "SSRS is down")
                return
            reports = [report for report in REPORTS if report["Id"] in self.report_ids]
            self._respond({"value": reports[skip : skip + top]})
        elif (report_id := self._rdl_report_id(parsed.path)) is not None:
            if report_id in self.failing_rdl_ids:
                self.send_error(500, "SSRS is down")
                return
            self._send(RDL, "application/xml")
        else:
            self.send_error(404)

    @staticmethod
    def _rdl_report_id(path: str) -> str | None:
        for template in RDL_PATHS:
            prefix, _, suffix = template.partition("{id}")
            if path.startswith(prefix) and path.endswith(suffix):
                return path[len(prefix) : len(path) - len(suffix)]
        return None

    def _respond(self, data: dict):
        self._send(json.dumps(data).encode(), "application/json")

    def _send(self, body: bytes, content_type: str):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


@pytest.fixture
def ssrs_server():
    server = HTTPServer(("127.0.0.1", 0), MockSsrsHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}/reports"
    server.shutdown()
    MockSsrsHandler.report_ids = ALL_REPORT_IDS
    MockSsrsHandler.failing_rdl_ids = frozenset()
    MockSsrsHandler.fail_later_report_pages = False


@pytest.mark.integration
class TestSsrsOutageNoDropE2E:
    SERVICE = "ssrs_outage_nodrop_e2e"

    def _config(self, host_port: str):
        return {
            "source": {
                "type": "ssrs",
                "serviceName": self.SERVICE,
                "serviceConnection": {
                    "config": {
                        "type": "Ssrs",
                        "hostPort": host_port,
                        "username": "test_user",
                        "password": "test_pass",
                    }
                },
                "sourceConfig": {
                    "config": {
                        "type": "DashboardMetadata",
                        "includeDataModels": True,
                        "markDeletedDashboards": True,
                        "markDeletedDataModels": True,
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

    @pytest.fixture(autouse=True)
    def clean_service(self, metadata):
        self._delete_service(metadata)
        yield
        self._delete_service(metadata)

    def _delete_service(self, metadata):
        service = metadata.get_by_name(entity=DashboardService, fqn=self.SERVICE)
        if service:
            metadata.delete(entity=DashboardService, entity_id=service.id, recursive=True, hard_delete=True)

    def _names(self, metadata, entity) -> set[str]:
        result = metadata.list_entities(entity=entity, params={"service": self.SERVICE})
        return {entity.name.root for entity in result.entities}

    def _run(self, ssrs_server: str) -> MetadataWorkflow:
        workflow = MetadataWorkflow.create(self._config(ssrs_server))
        workflow.execute()
        workflow.print_status()
        return workflow

    def _ingest_both_reports(self, metadata, ssrs_server):
        self._run(ssrs_server)
        assert self._names(metadata, Dashboard) == {"report-ok", "report-outage"}
        assert self._names(metadata, DashboardDataModel) == {"report-ok.Orders", "report-outage.Orders"}

    def test_report_definition_outage_keeps_datamodels(self, metadata, ssrs_server):
        self._ingest_both_reports(metadata, ssrs_server)

        MockSsrsHandler.failing_rdl_ids = frozenset({"report-outage"})
        workflow = self._run(ssrs_server)

        assert any("report definition" in failure.error.lower() for failure in workflow.source.status.failures)
        assert self._names(metadata, DashboardDataModel) == {"report-ok.Orders", "report-outage.Orders"}

    def test_report_listing_outage_keeps_dashboards_and_datamodels(self, metadata, ssrs_server, monkeypatch):
        self._ingest_both_reports(metadata, ssrs_server)

        # One report per page, so the second report sits on the page that fails.
        monkeypatch.setattr(ssrs_client, "PAGE_SIZE", 1)
        MockSsrsHandler.fail_later_report_pages = True
        workflow = self._run(ssrs_server)

        assert any("skip=1" in failure.error for failure in workflow.source.status.failures)
        assert self._names(metadata, Dashboard) == {"report-ok", "report-outage"}
        assert self._names(metadata, DashboardDataModel) == {"report-ok.Orders", "report-outage.Orders"}

    def test_complete_run_still_deletes_stale_entities(self, metadata, ssrs_server):
        self._ingest_both_reports(metadata, ssrs_server)

        MockSsrsHandler.report_ids = ("report-ok",)
        self._run(ssrs_server)

        assert self._names(metadata, Dashboard) == {"report-ok"}
        assert self._names(metadata, DashboardDataModel) == {"report-ok.Orders"}
