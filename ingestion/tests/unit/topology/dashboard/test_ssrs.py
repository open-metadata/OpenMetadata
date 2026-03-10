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
Unit tests for SSRS source
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.api.models import Either
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.ssrs.client import SsrsClient
from metadata.ingestion.source.dashboard.ssrs.metadata import SsrsSource
from metadata.ingestion.source.dashboard.ssrs.models import SsrsFolder, SsrsReport

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName("mock_ssrs"),
    name="mock_ssrs",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.Ssrs,
)

mock_config = {
    "source": {
        "type": "ssrs",
        "serviceName": "mock_ssrs",
        "serviceConnection": {
            "config": {
                "type": "Ssrs",
                "hostPort": "http://ssrs.example.com/reports",
                "username": "domain\\user",
                "password": "password",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DashboardMetadata",
                "dashboardFilterPattern": {},
                "chartFilterPattern": {},
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE"
                "2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXB"
                "iEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fN"
                "r3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3u"
                "d-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        },
    },
}

MOCK_REPORTS = [
    SsrsReport(
        Id="report-1",
        Name="Sales Report",
        Description="Monthly sales overview",
        Path="/Finance/Sales Report",
        Type="Report",
        Hidden=False,
    ),
    SsrsReport(
        Id="report-2",
        Name="Inventory Report",
        Description=None,
        Path="/Operations/Inventory Report",
        Type="Report",
        Hidden=False,
    ),
    SsrsReport(
        Id="report-3",
        Name="Root Report",
        Description="Report at root level",
        Path="/Root Report",
        Type="Report",
        Hidden=False,
    ),
]

MOCK_REPORTS_WITH_HIDDEN = MOCK_REPORTS + [
    SsrsReport(
        Id="report-hidden",
        Name="Hidden Report",
        Description="Should not appear",
        Path="/Finance/Hidden Report",
        Type="Report",
        Hidden=True,
    ),
]

MOCK_FOLDERS = [
    SsrsFolder(Id="folder-1", Name="Finance", Path="/Finance"),
    SsrsFolder(Id="folder-2", Name="Operations", Path="/Operations"),
]

EXPECTED_DASHBOARDS = [
    CreateDashboardRequest(
        name="report-1",
        displayName="Sales Report",
        description="Monthly sales overview",
        sourceUrl="http://ssrs.example.com/reports/report/Finance/Sales Report",
        service=FullyQualifiedEntityName("mock_ssrs"),
        project="Finance",
        charts=[],
    ),
    CreateDashboardRequest(
        name="report-2",
        displayName="Inventory Report",
        description=None,
        sourceUrl="http://ssrs.example.com/reports/report/Operations/Inventory Report",
        service=FullyQualifiedEntityName("mock_ssrs"),
        project="Operations",
        charts=[],
    ),
]


@pytest.fixture(scope="function")
def ssrs_source():
    with patch(
        "metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"
    ), patch("metadata.ingestion.source.dashboard.ssrs.connection.get_connection"):
        config = OpenMetadataWorkflowConfig.model_validate(mock_config)
        source = SsrsSource.create(
            mock_config["source"],
            OpenMetadata(config.workflowConfig.openMetadataServerConfig),
        )
        source.client = SimpleNamespace()
        source.context.get().__dict__[
            "dashboard_service"
        ] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root
        source.folder_path_map = {f.path: f.name for f in MOCK_FOLDERS}
        yield source


class TestSsrsSource:
    def test_dashboard_name(self, ssrs_source):
        for report in MOCK_REPORTS:
            assert ssrs_source.get_dashboard_name(report) == report.name

    def test_dashboard_details(self, ssrs_source):
        for report in MOCK_REPORTS:
            assert ssrs_source.get_dashboard_details(report) == report

    def test_dashboards_list(self, ssrs_source):
        ssrs_source.client.get_reports = lambda: MOCK_REPORTS
        result = ssrs_source.get_dashboards_list()
        assert result == MOCK_REPORTS
        assert len(result) == 3

    def test_dashboards_list_filters_hidden(self, ssrs_source):
        ssrs_source.client.get_reports = lambda: MOCK_REPORTS_WITH_HIDDEN
        result = ssrs_source.get_dashboards_list()
        assert len(result) == 3
        assert all(not r.hidden for r in result)

    def test_project_name(self, ssrs_source):
        assert ssrs_source.get_project_name(MOCK_REPORTS[0]) == "Finance"
        assert ssrs_source.get_project_name(MOCK_REPORTS[1]) == "Operations"
        assert ssrs_source.get_project_name(MOCK_REPORTS[2]) is None

    def test_yield_dashboard(self, ssrs_source):
        for report, expected in zip(MOCK_REPORTS[:2], EXPECTED_DASHBOARDS):
            ssrs_source.context.get().__dict__[
                "project_name"
            ] = ssrs_source.get_project_name(report)
            results = list(ssrs_source.yield_dashboard(report))
            assert len(results) == 1
            assert isinstance(results[0], Either)
            assert results[0].right == expected

    def test_yield_dashboard_no_description(self, ssrs_source):
        ssrs_source.context.get().__dict__["project_name"] = "Operations"
        results = list(ssrs_source.yield_dashboard(MOCK_REPORTS[1]))
        assert results[0].right.description is None

    def test_yield_dashboard_chart(self, ssrs_source):
        results = list(ssrs_source.yield_dashboard_chart(MOCK_REPORTS[0]))
        assert len(results) == 1
        chart = results[0].right
        assert isinstance(chart, CreateChartRequest)
        assert chart.displayName == "Sales Report"
        assert chart.chartType == ChartType.Other
        assert str(chart.name.root) == "report-1_chart"
        assert "report/Finance/Sales Report" in str(chart.sourceUrl.root)

    def test_yield_dashboard_chart_no_description(self, ssrs_source):
        results = list(ssrs_source.yield_dashboard_chart(MOCK_REPORTS[1]))
        assert len(results) == 1
        assert results[0].right.description is None

    def test_prepare_builds_folder_path_map(self, ssrs_source):
        ssrs_source.client.get_folders = lambda: MOCK_FOLDERS
        ssrs_source.folder_path_map = {}
        ssrs_source.prepare()
        assert ssrs_source.folder_path_map == {
            "/Finance": "Finance",
            "/Operations": "Operations",
        }

    def test_yield_dashboard_chart_filtered(self, ssrs_source):
        ssrs_source.source_config.chartFilterPattern = MagicMock()
        with patch(
            "metadata.ingestion.source.dashboard.ssrs.metadata.filter_by_chart",
            return_value=True,
        ):
            results = list(ssrs_source.yield_dashboard_chart(MOCK_REPORTS[0]))
        assert len(results) == 0

    def test_yield_dashboard_lineage_is_noop(self, ssrs_source):
        result = ssrs_source.yield_dashboard_lineage_details(MOCK_REPORTS[0])
        assert result is None


class TestSsrsModels:
    def test_ssrs_report_parsing(self):
        data = {
            "Id": "abc-123",
            "Name": "Sales Report",
            "Description": "Monthly sales",
            "Path": "/Finance/Sales Report",
            "Type": "Report",
            "Hidden": False,
        }
        report = SsrsReport(**data)
        assert report.id == "abc-123"
        assert report.name == "Sales Report"
        assert report.description == "Monthly sales"
        assert report.path == "/Finance/Sales Report"

    def test_ssrs_folder_parsing(self):
        data = {
            "Id": "folder-1",
            "Name": "Finance",
            "Path": "/Finance",
        }
        folder = SsrsFolder(**data)
        assert folder.id == "folder-1"
        assert folder.name == "Finance"
        assert folder.path == "/Finance"

    def test_ssrs_report_no_description(self):
        data = {
            "Id": "abc-456",
            "Name": "No Desc Report",
            "Path": "/Reports/No Desc Report",
        }
        report = SsrsReport(**data)
        assert report.description is None
        assert report.hidden is False

    def test_ssrs_report_hidden(self):
        data = {
            "Id": "abc-789",
            "Name": "Hidden Report",
            "Path": "/Reports/Hidden Report",
            "Hidden": True,
        }
        report = SsrsReport(**data)
        assert report.hidden is True


class TestSsrsClientPagination:
    def test_get_reports_single_page(self):
        client = MagicMock(spec=SsrsClient)
        client.get_reports = SsrsClient.get_reports.__get__(client)
        client._get = MagicMock(
            return_value={
                "value": [
                    {
                        "Id": f"r-{i}",
                        "Name": f"Report {i}",
                        "Path": f"/Reports/Report {i}",
                    }
                    for i in range(3)
                ]
            }
        )
        reports = client.get_reports()
        assert len(reports) == 3
        client._get.assert_called_once()

    def test_get_reports_multi_page(self):
        client = MagicMock(spec=SsrsClient)
        client.get_reports = SsrsClient.get_reports.__get__(client)

        page1 = {
            "value": [
                {
                    "Id": f"r-{i}",
                    "Name": f"Report {i}",
                    "Path": f"/Reports/Report {i}",
                }
                for i in range(100)
            ]
        }
        page2 = {
            "value": [
                {
                    "Id": f"r-{i}",
                    "Name": f"Report {i}",
                    "Path": f"/Reports/Report {i}",
                }
                for i in range(100, 150)
            ]
        }
        client._get = MagicMock(side_effect=[page1, page2])

        reports = client.get_reports()
        assert len(reports) == 150
        assert client._get.call_count == 2
        _, kwargs1 = client._get.call_args_list[0]
        _, kwargs2 = client._get.call_args_list[1]
        assert kwargs1["params"]["$skip"] == "0"
        assert kwargs2["params"]["$skip"] == "100"

    def test_get_folders_multi_page(self):
        client = MagicMock(spec=SsrsClient)
        client.get_folders = SsrsClient.get_folders.__get__(client)

        page1 = {
            "value": [
                {"Id": f"f-{i}", "Name": f"Folder {i}", "Path": f"/Folder {i}"}
                for i in range(100)
            ]
        }
        page2 = {
            "value": [
                {"Id": f"f-{i}", "Name": f"Folder {i}", "Path": f"/Folder {i}"}
                for i in range(100, 120)
            ]
        }
        client._get = MagicMock(side_effect=[page1, page2])

        folders = client.get_folders()
        assert len(folders) == 120
        assert client._get.call_count == 2

    def test_get_reports_empty(self):
        client = MagicMock(spec=SsrsClient)
        client.get_reports = SsrsClient.get_reports.__get__(client)
        client._get = MagicMock(return_value={"value": []})
        reports = client.get_reports()
        assert len(reports) == 0
        client._get.assert_called_once()
