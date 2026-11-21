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
End-to-end regression for the SSRS transient-outage no-drop guarantee.

A transient SSRS outage on the report-definition endpoint during a run with
``includeDataModels=True`` and ``markDeletedDataModels=True`` must NOT soft-delete
previously ingested data models. Requires a live OpenMetadata server at
http://localhost:8585.
"""

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

import pytest

from _openmetadata_testutils.ometa import OM_JWT
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.workflow.metadata import MetadataWorkflow

# Two visible reports, both with data sources so the RDL fetch is attempted.
MOCK_REPORTS_OUTAGE = [
    {
        "Id": "report-ok",
        "Name": "OK Report",
        "Description": "Should ingest data model",
        "Path": "/Folder/OK Report",
        "Type": "Report",
        "Hidden": False,
        "HasDataSources": True,
    },
    {
        "Id": "report-outage",
        "Name": "Outage Report",
        "Description": "RDL fetch fails transiently",
        "Path": "/Folder/Outage Report",
        "Type": "Report",
        "Hidden": False,
        "HasDataSources": True,
    },
]

MOCK_FOLDERS_OUTAGE = [{"Id": "folder-1", "Name": "Folder", "Path": "/Folder"}]

RDL_OK = (
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


class OutageSsrsHandler(BaseHTTPRequestHandler):
    """Mock SSRS that returns 500 for the outage report's RDL, 200 otherwise."""

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == "/reports/api/v2.0/Folders":
            self._respond({"value": MOCK_FOLDERS_OUTAGE})
        elif path == "/reports/api/v2.0/Reports":
            top = int(params.get("$top", [str(len(MOCK_REPORTS_OUTAGE))])[0])
            skip = int(params.get("$skip", ["0"])[0])
            self._respond({"value": MOCK_REPORTS_OUTAGE[skip : skip + top]})
        elif self._match_rdl(path) is not None:
            report_id = self._match_rdl(path)
            if report_id == "report-outage":
                # Transient outage on the report-definition endpoint.
                self.send_error(500, "SSRS is down")
                return
            self._respond_rdl(RDL_OK)
        else:
            self.send_error(404)

    @staticmethod
    def _match_rdl(path: str):
        for template in (
            "/reports/api/v2.0/Reports({id})/Content/$value",
            "/reports/api/v2.0/CatalogItems({id})/Content",
        ):
            prefix, _, suffix = template.partition("{id}")
            if path.startswith(prefix) and path.endswith(suffix):
                return path[len(prefix) : len(path) - len(suffix)]
        return None

    def _respond(self, data: dict):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _respond_rdl(self, body: bytes):
        self.send_response(200)
        self.send_header("Content-Type", "application/xml")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


@pytest.fixture(scope="module")
def outage_ssrs_server():
    server = HTTPServer(("127.0.0.1", 0), OutageSsrsHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}/reports"
    server.shutdown()


class HealthySsrsHandler(BaseHTTPRequestHandler):
    """Mock SSRS where every report's RDL fetch succeeds. Used to verify the
    healthy-listing path still soft-deletes genuinely stale data models."""

    # A module-level mutable so a test can switch the second report off for the
    # second run (simulating a real deletion in SSRS).
    report_subset: list[str] | None = None

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == "/reports/api/v2.0/Folders":
            self._respond({"value": MOCK_FOLDERS_OUTAGE})
        elif path == "/reports/api/v2.0/Reports":
            reports = MOCK_REPORTS_OUTAGE
            if self.report_subset is not None:
                reports = [r for r in reports if r["Id"] in self.report_subset]
            top = int(params.get("$top", [str(len(reports))])[0])
            skip = int(params.get("$skip", ["0"])[0])
            self._respond({"value": reports[skip : skip + top]})
        elif self._match_rdl(path) is not None:
            self._respond_rdl(RDL_OK)
        else:
            self.send_error(404)

    @staticmethod
    def _match_rdl(path: str):
        for template in (
            "/reports/api/v2.0/Reports({id})/Content/$value",
            "/reports/api/v2.0/CatalogItems({id})/Content",
        ):
            prefix, _, suffix = template.partition("{id}")
            if path.startswith(prefix) and path.endswith(suffix):
                return path[len(prefix) : len(path) - len(suffix)]
        return None

    def _respond(self, data: dict):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _respond_rdl(self, body: bytes):
        self.send_response(200)
        self.send_header("Content-Type", "application/xml")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


@pytest.fixture(scope="module")
def healthy_ssrs_server():
    HealthySsrsHandler.report_subset = None  # reset
    server = HTTPServer(("127.0.0.1", 0), HealthySsrsHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}/reports"
    server.shutdown()


@pytest.mark.integration
class TestSsrsOutageNoDropE2E:
    """End-to-end: a transient SSRS RDL outage must not soft-delete previously
    ingested data models when ``markDeletedDataModels=True``."""

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

    def _delete_service(self, metadata):
        svc = metadata.get_by_name(entity=DashboardService, fqn=self.SERVICE)
        if svc:
            metadata.delete(entity=DashboardService, entity_id=svc.id, recursive=True, hard_delete=True)

    def _datamodel_names(self, metadata) -> set[str]:
        """List data model displayNames ingested for this service."""
        result = metadata.list_entities(entity=DashboardDataModel, fields=["*"], params={"service": self.SERVICE})
        return {str(d.name.root) for d in result.entities}

    def test_datamodels_survive_transient_outage(self, metadata, outage_ssrs_server):
        # Run the outage-affected workflow. The run reports 2 visible errors (one per
        # failed stage: datamodel + lineage) instead of silently succeeding — this is
        # the intended behavior change. We do NOT call raise_from_status so the test
        # can inspect the resulting catalog state.
        self._delete_service(metadata)
        workflow = MetadataWorkflow.create(self._config(outage_ssrs_server))
        workflow.execute()
        workflow.print_status()

        # The outage report's RDL fetch failing should yield a visible failure record,
        # not a clean run.
        assert workflow.source.status.failures, "Outage report should produce a status.failures record"
        assert any(
            "report definition" in (getattr(f, "error", "") or "").lower() for f in workflow.source.status.failures
        ), f"Expected 'report definition' error in failed records: {workflow.source.status.failures}"

        # The OK report's data model must exist in the catalog; the outage report's
        # must NOT (its RDL was never fetched).
        names_after_run1 = self._datamodel_names(metadata)
        assert "report-ok.Orders" in names_after_run1, (
            f"report-ok data model should have been ingested on the first run; got {names_after_run1}"
        )
        assert "report-outage.Orders" not in names_after_run1, (
            "report-outage data model should not exist (RDL never fetched)"
        )

        # 2. Run a second time. The outage persists. The previously-ingested report-ok
        #    data model MUST still exist (the failed-listing guard skips mark-deleted).
        workflow2 = MetadataWorkflow.create(self._config(outage_ssrs_server))
        workflow2.execute()
        workflow2.print_status()

        names_after_run2 = self._datamodel_names(metadata)
        assert "report-ok.Orders" in names_after_run2, (
            "report-ok data model must survive a transient outage run — the mark-deleted "
            f"guard must skip deletion when the datamodel listing failed; got {names_after_run2}"
        )

        # Cleanup
        self._delete_service(metadata)

    def test_healthy_listing_still_soft_deletes_stale_datamodels(self, metadata, healthy_ssrs_server):
        """Regression: a healthy run where a report is removed in SSRS must still
        soft-delete that report's data model. This confirms the guard does not
        accidentally suppress the healthy-listing staleness check."""
        self._delete_service(metadata)
        # Run 1: both reports present and healthy → both data models ingested.
        HealthySsrsHandler.report_subset = ["report-ok", "report-outage"]
        workflow1 = MetadataWorkflow.create(self._config(healthy_ssrs_server))
        workflow1.execute()
        workflow1.print_status()
        names1 = self._datamodel_names(metadata)
        assert "report-ok.Orders" in names1 and "report-outage.Orders" in names1, (
            f"both data models should be ingested on the healthy run; got {names1}"
        )

        # Run 2: report-outage is removed in SSRS (no outage, just deletion). The healthy
        # listing must trigger the staleness check and soft-delete report-outage.Orders.
        HealthySsrsHandler.report_subset = ["report-ok"]
        workflow2 = MetadataWorkflow.create(self._config(healthy_ssrs_server))
        workflow2.execute()
        workflow2.print_status()
        names2 = self._datamodel_names(metadata)
        assert "report-ok.Orders" in names2, f"report-ok should still be present; got {names2}"
        assert "report-outage.Orders" not in names2, (
            f"report-outage data model should be soft-deleted on the healthy listing run; got {names2}"
        )

        # Cleanup
        self._delete_service(metadata)

    def test_recovery_after_outage_restores_datamodels(self, metadata, outage_ssrs_server, healthy_ssrs_server):
        """A successful run after an outage must restore the previously-skipped data
        models and re-apply lineage (the disappearance window closes)."""
        self._delete_service(metadata)
        # Run 1: outage on report-outage → only report-ok ingested.
        workflow1 = MetadataWorkflow.create(self._config(outage_ssrs_server))
        workflow1.execute()
        names1 = self._datamodel_names(metadata)
        assert "report-ok.Orders" in names1
        assert "report-outage.Orders" not in names1

        # Run 2: outage resolves (healthy server, both reports present) → both data
        # models now exist, including the previously-missing report-outage one.
        HealthySsrsHandler.report_subset = ["report-ok", "report-outage"]
        workflow2 = MetadataWorkflow.create(self._config(healthy_ssrs_server))
        workflow2.execute()
        names2 = self._datamodel_names(metadata)
        assert "report-ok.Orders" in names2 and "report-outage.Orders" in names2, (
            f"both data models should be restored after recovery; got {names2}"
        )

        # Cleanup
        self._delete_service(metadata)
