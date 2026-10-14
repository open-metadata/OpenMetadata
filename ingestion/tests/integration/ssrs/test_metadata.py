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
Ssrs integration tests using a mock HTTP server
"""

import pytest

from _openmetadata_testutils.ometa import OM_JWT
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.services.connections.dashboard.ssrsConnection import (
    SsrsConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.ingestion.source.dashboard.ssrs.client import SsrsClient
from metadata.workflow.metadata import MetadataWorkflow


@pytest.mark.integration
class TestSsrsMetadata:
    def test_client_get_reports(self, ssrs_service):
        connection = SsrsConnection(hostPort=ssrs_service, username="test_user", password="test_pass")
        client = SsrsClient(connection)
        reports = list(client.get_reports())
        assert len(reports) == 4
        assert reports[0].name == "Report 1"
        assert reports[0].path == "/TestFolder/Report 1"

    def test_client_get_folders(self, ssrs_service):
        connection = SsrsConnection(hostPort=ssrs_service, username="test_user", password="test_pass")
        client = SsrsClient(connection)
        folders = list(client.get_folders())
        assert len(folders) == 1
        assert folders[0].name == "TestFolder"

    def test_client_test_access(self, ssrs_service):
        connection = SsrsConnection(hostPort=ssrs_service, username="test_user", password="test_pass")
        client = SsrsClient(connection)
        client.test_access()

    def test_hidden_reports_present_in_raw(self, ssrs_service):
        connection = SsrsConnection(hostPort=ssrs_service, username="test_user", password="test_pass")
        client = SsrsClient(connection)
        reports = list(client.get_reports())
        assert any(r.hidden for r in reports)
        visible = [r for r in reports if not r.hidden]
        assert len(visible) == 3

    def test_client_get_report_definition_returns_bytes(self, ssrs_service):
        connection = SsrsConnection(hostPort=ssrs_service, username="test_user", password="test_pass")
        client = SsrsClient(connection)
        rdl = client.get_report_definition("report-1")
        assert rdl is not None
        assert b"<DataSets>" in rdl
        assert b"SELECT OrderId FROM dbo.Orders" in rdl

    def test_client_get_report_definition_404_returns_none(self, ssrs_service):
        connection = SsrsConnection(hostPort=ssrs_service, username="test_user", password="test_pass")
        client = SsrsClient(connection)
        assert client.get_report_definition("does-not-exist") is None

    def test_end_to_end_rdl_parse_via_mock_server(self, ssrs_service):
        from metadata.ingestion.source.dashboard.ssrs.rdl_parser import parse_rdl

        connection = SsrsConnection(hostPort=ssrs_service, username="test_user", password="test_pass")
        client = SsrsClient(connection)
        rdl = client.get_report_definition("report-1")
        parsed = parse_rdl(rdl)
        assert len(parsed.data_sets) == 1
        assert parsed.data_sets[0].command_text == "SELECT OrderId FROM dbo.Orders"
        assert parsed.data_sources[0].database == "SalesDB"


@pytest.mark.integration
class TestSsrsDashboardChartLineage:
    """The Dashboard -> Chart edge comes from the shared dashboard topology, so SSRS
    draws it with no connector code. Each report is a dashboard holding one chart of
    the same name. Requires a server at http://localhost:8585."""

    SERVICE = "ssrs_dashboard_it"

    @pytest.fixture(scope="class")
    def ingested(self, metadata, run_workflow, ssrs_service):
        self._delete_service(metadata)
        config = {
            "source": {
                "type": "ssrs",
                "serviceName": self.SERVICE,
                "serviceConnection": {
                    "config": {
                        "type": "Ssrs",
                        "hostPort": ssrs_service,
                        "username": "test_user",
                        "password": "test_pass",
                    }
                },
                "sourceConfig": {
                    "config": {
                        "type": "DashboardMetadata",
                        "chartFilterPattern": {"excludes": ["^Report 3$"]},
                        "includeDataModels": False,
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
        try:
            yield run_workflow(MetadataWorkflow, config)
        finally:
            self._delete_service(metadata)

    def _delete_service(self, metadata) -> None:
        service = metadata.get_by_name(entity=DashboardService, fqn=self.SERVICE)
        if service:
            metadata.delete(entity=DashboardService, entity_id=service.id, recursive=True, hard_delete=True)

    def _chart_edges(self, metadata, report_id: str) -> list[tuple[str, str]]:
        dashboard = metadata.get_by_name(entity=Dashboard, fqn=f"{self.SERVICE}.{report_id}")
        assert dashboard is not None, f"{report_id} was not ingested"
        lineage = metadata.get_lineage_by_id(entity=Dashboard, entity_id=dashboard.id.root, up_depth=0, down_depth=1)
        nodes = {node["id"]: node for node in lineage.get("nodes", [])}
        return sorted(
            (nodes[edge["toEntity"]]["fullyQualifiedName"], edge["lineageDetails"]["source"])
            for edge in lineage.get("downstreamEdges", [])
            if edge["fromEntity"] == str(dashboard.id.root)
        )

    def test_each_report_links_its_own_chart(self, metadata, ingested):
        for report_id in ("report-1", "report-2"):
            assert self._chart_edges(metadata, report_id) == [(f"{self.SERVICE}.{report_id}_chart", "DashboardLineage")]

    def test_a_filtered_chart_gets_no_entity_and_no_edge(self, metadata, ingested):
        assert {"Report 3": "Chart Pattern not allowed"} in ingested.source.status.filtered
        assert metadata.get_by_name(entity=Chart, fqn=f"{self.SERVICE}.report-3_chart") is None
        assert self._chart_edges(metadata, "report-3") == []
