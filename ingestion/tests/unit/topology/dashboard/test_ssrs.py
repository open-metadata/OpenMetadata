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
import requests

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.api.models import Either
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.ssrs.client import SsrsClient
from metadata.ingestion.source.dashboard.ssrs.metadata import SsrsSource
from metadata.ingestion.source.dashboard.ssrs.models import SsrsFolder, SsrsReport
from metadata.ingestion.source.dashboard.ssrs.rdl_parser import (
    SsrsDataSet,
    SsrsDataSource,
    SsrsField,
    SsrsReportDefinition,
)

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
        ssrs_source.client.get_reports = lambda: iter(MOCK_REPORTS)
        result = list(ssrs_source.get_dashboards_list())
        assert result == MOCK_REPORTS
        assert len(result) == 3

    def test_dashboards_list_filters_hidden(self, ssrs_source):
        ssrs_source.client.get_reports = lambda: iter(MOCK_REPORTS_WITH_HIDDEN)
        result = list(ssrs_source.get_dashboards_list())
        assert len(result) == 3
        assert all(not r.hidden for r in result)

    def test_hidden_reports_recorded_in_status(self, ssrs_source):
        ssrs_source.client.get_reports = lambda: iter(MOCK_REPORTS_WITH_HIDDEN)
        ssrs_source.status = MagicMock()
        list(ssrs_source.get_dashboards_list())
        ssrs_source.status.filter.assert_called_once_with(
            "Hidden Report", "Hidden report"
        )

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

    def test_chart_source_state_populated(self, ssrs_source):
        """Verify register_record_chart populates chart_source_state after yield_dashboard_chart."""
        ssrs_source.chart_source_state = set()
        list(ssrs_source.yield_dashboard_chart(MOCK_REPORTS[0]))
        assert len(ssrs_source.chart_source_state) == 1
        assert any("mock_ssrs" in fqn for fqn in ssrs_source.chart_source_state)


class TestSsrsOwnership:
    def test_get_owner_ref_strips_domain_and_looks_up_user(self, ssrs_source):
        report = SsrsReport(
            Id="r-owner-1",
            Name="Owned Report",
            Path="/Finance/Owned",
            CreatedBy="CONTOSO\\alice",
        )
        ssrs_source.source_config.includeOwners = True
        sentinel = object()
        ssrs_source.metadata = MagicMock()
        ssrs_source.metadata.get_reference_by_name = MagicMock(return_value=sentinel)

        result = ssrs_source.get_owner_ref(report)

        assert result is sentinel
        ssrs_source.metadata.get_reference_by_name.assert_called_once_with(
            name="alice", is_owner=True
        )

    def test_get_owner_ref_handles_plain_username(self, ssrs_source):
        report = SsrsReport(
            Id="r-owner-2",
            Name="Plain Owner",
            Path="/Ops/Plain",
            CreatedBy="bob",
        )
        ssrs_source.source_config.includeOwners = True
        ssrs_source.metadata = MagicMock()
        ssrs_source.metadata.get_reference_by_name = MagicMock(return_value=None)

        ssrs_source.get_owner_ref(report)
        ssrs_source.metadata.get_reference_by_name.assert_called_once_with(
            name="bob", is_owner=True
        )

    def test_get_owner_ref_skipped_when_include_owners_false(self, ssrs_source):
        report = SsrsReport(
            Id="r-owner-3",
            Name="Skip Owner",
            Path="/Ops/Skip",
            CreatedBy="CONTOSO\\carol",
        )
        ssrs_source.source_config.includeOwners = False
        ssrs_source.metadata = MagicMock()

        assert ssrs_source.get_owner_ref(report) is None
        ssrs_source.metadata.get_reference_by_name.assert_not_called()

    def test_get_owner_ref_returns_none_when_created_by_missing(self, ssrs_source):
        report = SsrsReport(
            Id="r-owner-4",
            Name="No Owner",
            Path="/Ops/None",
        )
        ssrs_source.source_config.includeOwners = True
        ssrs_source.metadata = MagicMock()

        assert ssrs_source.get_owner_ref(report) is None
        ssrs_source.metadata.get_reference_by_name.assert_not_called()

    def test_get_owner_ref_swallows_lookup_exceptions(self, ssrs_source):
        report = SsrsReport(
            Id="r-owner-5",
            Name="Boom",
            Path="/Ops/Boom",
            CreatedBy="CONTOSO\\dan",
        )
        ssrs_source.source_config.includeOwners = True
        ssrs_source.metadata = MagicMock()
        ssrs_source.metadata.get_reference_by_name = MagicMock(
            side_effect=Exception("lookup failed")
        )

        assert ssrs_source.get_owner_ref(report) is None

    def test_yield_dashboard_continues_when_owner_not_found(self, ssrs_source):
        report = SsrsReport(
            Id="r-owner-missing",
            Name="Unknown Owner",
            Path="/Finance/Unknown Owner",
            CreatedBy="CONTOSO\\ghost",
        )
        ssrs_source.source_config.includeOwners = True
        ssrs_source.metadata = MagicMock()
        ssrs_source.metadata.get_reference_by_name = MagicMock(return_value=None)
        ssrs_source.context.get().__dict__["project_name"] = "Finance"

        results = list(ssrs_source.yield_dashboard(report))

        assert len(results) == 1
        assert isinstance(results[0].right, CreateDashboardRequest)
        assert results[0].right.owners is None
        assert str(results[0].right.name.root) == "r-owner-missing"

    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("CONTOSO\\alice", "alice"),
            ("alice", "alice"),
            ("\\alice", "alice"),
            ("CONTOSO\\", None),
            ("", None),
            (None, None),
            ("   ", None),
            ("  bob  ", "bob"),
        ],
    )
    def test_normalize_owner_variants(self, raw, expected):
        assert SsrsSource._normalize_owner(raw) == expected

    def test_yield_dashboard_continues_when_owner_lookup_raises(self, ssrs_source):
        report = SsrsReport(
            Id="r-owner-raises",
            Name="Raises Owner",
            Path="/Finance/Raises",
            CreatedBy="CONTOSO\\eve",
        )
        ssrs_source.source_config.includeOwners = True
        ssrs_source.metadata = MagicMock()
        ssrs_source.metadata.get_reference_by_name = MagicMock(
            side_effect=Exception("OM lookup failed")
        )
        ssrs_source.context.get().__dict__["project_name"] = "Finance"

        results = list(ssrs_source.yield_dashboard(report))

        assert len(results) == 1
        assert isinstance(results[0].right, CreateDashboardRequest)
        assert results[0].right.owners is None


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

    def test_ssrs_report_created_by_alias(self):
        data = {
            "Id": "abc-999",
            "Name": "Owned Report",
            "Path": "/Reports/Owned",
            "CreatedBy": "CONTOSO\\alice",
        }
        report = SsrsReport(**data)
        assert report.created_by == "CONTOSO\\alice"


def _build_mock_client():
    """Return a MagicMock with the real ``get_reports``/``get_folders``/``_paginate``
    bound so tests exercise the pagination + error-propagation logic while only
    stubbing out the HTTP call (``_get``)."""
    client = MagicMock(spec=SsrsClient)
    client._paginate = SsrsClient._paginate.__get__(client)
    client.get_reports = SsrsClient.get_reports.__get__(client)
    client.get_folders = SsrsClient.get_folders.__get__(client)
    return client


class _StreamResponseStub:
    """Minimal context-manager stand-in for ``requests.Response`` in streaming mode."""

    def __init__(self, chunks, headers=None, status_code=200):
        self._chunks = chunks
        self.headers = headers or {}
        self.status_code = status_code

    @property
    def ok(self) -> bool:
        return 200 <= self.status_code < 400

    def iter_content(self, chunk_size=None):
        yield from self._chunks

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class TestSsrsClientRdl:
    def _client(self):
        from metadata.generated.schema.entity.services.connections.dashboard.ssrsConnection import (
            SsrsConnection,
        )

        return SsrsClient(
            SsrsConnection(
                hostPort="http://ssrs.example.com/reports",
                username="u",
                password="p",
            )
        )

    def test_get_report_definition_aborts_on_oversized_stream(self, monkeypatch):
        from metadata.ingestion.source.dashboard.ssrs import client as client_module

        monkeypatch.setattr(client_module, "MAX_RDL_BYTES", 100)
        client = self._client()
        oversized_chunks = [b"x" * 60, b"y" * 60]
        client.session = MagicMock()
        client.session.get = MagicMock(
            return_value=_StreamResponseStub(
                chunks=oversized_chunks,
                headers={"Content-Type": "application/xml"},
            )
        )
        assert client.get_report_definition("big-report") is None
        client.session.get.assert_called()
        assert client.session.get.call_args.kwargs["stream"] is True

    def test_get_report_definition_raises_on_permission_error(self):
        client = self._client()
        client.session = MagicMock()
        client.session.get = MagicMock(
            side_effect=[
                _StreamResponseStub(chunks=iter([]), status_code=403),
                _StreamResponseStub(chunks=iter([]), status_code=403),
            ]
        )
        with pytest.raises(SourceConnectionException):
            client.get_report_definition("no-access")

    def test_get_report_definition_raises_on_server_error(self):
        client = self._client()
        client.session = MagicMock()
        client.session.get = MagicMock(
            side_effect=[
                _StreamResponseStub(chunks=iter([]), status_code=500),
                _StreamResponseStub(chunks=iter([]), status_code=500),
            ]
        )
        with pytest.raises(SourceConnectionException):
            client.get_report_definition("broken")

    def test_get_report_definition_404_triggers_silent_fallback(self):
        client = self._client()
        client.session = MagicMock()
        client.session.get = MagicMock(
            side_effect=[
                _StreamResponseStub(chunks=iter([]), status_code=404),
                _StreamResponseStub(chunks=iter([]), status_code=404),
            ]
        )
        assert client.get_report_definition("missing") is None

    def test_get_report_definition_rejects_by_content_length_before_reading(
        self, monkeypatch
    ):
        from metadata.ingestion.source.dashboard.ssrs import client as client_module

        monkeypatch.setattr(client_module, "MAX_RDL_BYTES", 100)
        client = self._client()

        def exploding_chunks():
            raise AssertionError("body should not be read when Content-Length trips")
            yield

        stub = _StreamResponseStub(
            chunks=exploding_chunks(),
            headers={"Content-Length": "999", "Content-Type": "application/xml"},
        )
        client.session = MagicMock()
        client.session.get = MagicMock(return_value=stub)
        assert client.get_report_definition("big-by-header") is None


class TestSsrsClientPagination:
    def test_get_reports_single_page(self):
        client = _build_mock_client()
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
        reports = list(client.get_reports())
        assert len(reports) == 3
        client._get.assert_called_once()

    def test_get_reports_multi_page(self):
        client = _build_mock_client()

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

        reports = list(client.get_reports())
        assert len(reports) == 150
        assert client._get.call_count == 2
        _, kwargs1 = client._get.call_args_list[0]
        _, kwargs2 = client._get.call_args_list[1]
        assert kwargs1["params"]["$skip"] == "0"
        assert kwargs2["params"]["$skip"] == "100"

    def test_get_reports_streams_lazily(self):
        client = _build_mock_client()

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

        reports_iter = client.get_reports()
        first = next(reports_iter)
        assert first.id == "r-0"
        assert client._get.call_count == 1

    def test_get_folders_multi_page(self):
        client = _build_mock_client()

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

        folders = list(client.get_folders())
        assert len(folders) == 120
        assert client._get.call_count == 2

    def test_get_reports_empty(self):
        client = _build_mock_client()
        client._get = MagicMock(return_value={"value": []})
        reports = list(client.get_reports())
        assert len(reports) == 0
        client._get.assert_called_once()

    def test_get_reports_sends_optimized_odata_params(self):
        client = _build_mock_client()
        client._get = MagicMock(return_value={"value": []})

        list(client.get_reports())

        _, kwargs = client._get.call_args
        params = kwargs["params"]
        assert params["$orderby"] == "Id"
        assert "Id" in params["$select"]
        assert "Hidden" in params["$select"]
        assert params["$top"] == "100"
        assert params["$skip"] == "0"

    def test_get_folders_sends_optimized_odata_params(self):
        client = _build_mock_client()
        client._get = MagicMock(return_value={"value": []})

        list(client.get_folders())

        _, kwargs = client._get.call_args
        params = kwargs["params"]
        assert params["$orderby"] == "Id"
        assert params["$select"] == "Id,Name,Path"

    def test_get_reports_raises_on_persistent_failure(self):
        """Ensure a failed page surfaces as SourceConnectionException rather
        than a silently truncated stream — otherwise mark-deleted would wipe
        dashboards whenever SSRS is slow or briefly down."""
        client = _build_mock_client()
        client._get = MagicMock(side_effect=requests.ReadTimeout("boom"))

        with pytest.raises(SourceConnectionException):
            list(client.get_reports())

    def test_get_reports_raises_mid_stream(self):
        """If page N succeeds but page N+1 fails, the generator must raise —
        yielding a partial set silently would cause mark_deleted to drop the
        rest of the catalog."""
        client = _build_mock_client()
        page1 = {
            "value": [
                {"Id": f"r-{i}", "Name": f"R{i}", "Path": f"/R{i}"} for i in range(100)
            ]
        }
        client._get = MagicMock(side_effect=[page1, requests.ReadTimeout("mid-stream")])

        reports_iter = client.get_reports()
        first_page = [next(reports_iter) for _ in range(100)]
        assert len(first_page) == 100
        with pytest.raises(SourceConnectionException):
            next(reports_iter)

    def test_get_folders_raises_on_failure(self):
        client = _build_mock_client()
        client._get = MagicMock(side_effect=requests.ConnectionError("no route"))

        with pytest.raises(SourceConnectionException):
            list(client.get_folders())


RDL_SALES = SsrsReportDefinition(
    data_sources=[
        SsrsDataSource(
            name="SalesDS",
            data_provider="SQL",
            connect_string="Data Source=sql01;Initial Catalog=SalesDB",
            server="sql01",
            database="SalesDB",
        )
    ],
    data_sets=[
        SsrsDataSet(
            name="SalesDataset",
            data_source_name="SalesDS",
            command_type="Text",
            command_text="SELECT OrderId, CustomerName FROM dbo.Orders",
            fields=[
                SsrsField(name="OrderId", data_field="OrderId"),
                SsrsField(name="CustomerName", data_field="CustomerName"),
            ],
        )
    ],
)

RDL_MULTI = SsrsReportDefinition(
    data_sources=[
        SsrsDataSource(
            name="FinanceDS",
            data_provider="SQL",
            connect_string="Server=fin;Database=FinanceDB",
            server="fin",
            database="FinanceDB",
        )
    ],
    data_sets=[
        SsrsDataSet(
            name="Revenue",
            data_source_name="FinanceDS",
            command_type="Text",
            command_text="SELECT MonthName, Amount FROM dbo.Revenue",
            fields=[SsrsField(name="MonthName"), SsrsField(name="Amount")],
        ),
        SsrsDataSet(
            name="Expenses",
            data_source_name="FinanceDS",
            command_type="Text",
            command_text="SELECT Category, Amount FROM dbo.Expenses",
            fields=[SsrsField(name="Category"), SsrsField(name="Amount")],
        ),
    ],
)

RDL_EXPRESSION = SsrsReportDefinition(
    data_sources=[SsrsDataSource(name="D", data_provider="SQL", database="DB")],
    data_sets=[
        SsrsDataSet(
            name="Dyn",
            data_source_name="D",
            command_type="Expression",
            command_text='="SELECT * FROM " & Parameters!Tbl.Value',
        )
    ],
)

RDL_STORED_PROC = SsrsReportDefinition(
    data_sources=[SsrsDataSource(name="D", data_provider="SQL", database="DB")],
    data_sets=[
        SsrsDataSet(
            name="Proc",
            data_source_name="D",
            command_type="StoredProcedure",
            command_text="dbo.usp_GetThings",
        )
    ],
)

RDL_MDX = SsrsReportDefinition(
    data_sources=[
        SsrsDataSource(name="Cube", data_provider="OLEDB-MD", database="OLAP")
    ],
    data_sets=[
        SsrsDataSet(
            name="MDXQuery",
            data_source_name="Cube",
            command_type="Text",
            command_text="SELECT [Measures].[X] ON 0 FROM [Cube]",
        )
    ],
)


def _set_context(source, **kwargs):
    for key, value in kwargs.items():
        source.context.get().__dict__[key] = value


class TestSsrsYieldDatamodel:
    def _prepare(self, ssrs_source, rdl):
        ssrs_source._current_rdl = (MOCK_REPORTS[0].id, rdl)
        ssrs_source.source_config.includeDataModels = True

    def test_emits_one_per_dataset(self, ssrs_source):
        self._prepare(ssrs_source, RDL_MULTI)
        results = list(ssrs_source.yield_datamodel(MOCK_REPORTS[0]))
        names = [str(r.right.name.root) for r in results]
        assert names == [
            f"{MOCK_REPORTS[0].id}.Revenue",
            f"{MOCK_REPORTS[0].id}.Expenses",
        ]
        assert all(r.right.dataModelType.value == "SsrsDataModel" for r in results)

    def test_single_dataset_attaches_sql_and_columns(self, ssrs_source):
        self._prepare(ssrs_source, RDL_SALES)
        results = list(ssrs_source.yield_datamodel(MOCK_REPORTS[0]))
        assert len(results) == 1
        model = results[0].right
        assert model.sql.root == "SELECT OrderId, CustomerName FROM dbo.Orders"
        assert [c.name.root for c in model.columns] == ["OrderId", "CustomerName"]

    def test_sql_omitted_for_stored_procedure(self, ssrs_source):
        self._prepare(ssrs_source, RDL_STORED_PROC)
        results = list(ssrs_source.yield_datamodel(MOCK_REPORTS[0]))
        assert results[0].right.sql is None

    def test_sql_omitted_for_expression(self, ssrs_source):
        self._prepare(ssrs_source, RDL_EXPRESSION)
        results = list(ssrs_source.yield_datamodel(MOCK_REPORTS[0]))
        assert results[0].right.sql is None

    def test_skipped_when_include_data_models_false(self, ssrs_source):
        ssrs_source._current_rdl = (MOCK_REPORTS[0].id, RDL_SALES)
        ssrs_source.source_config.includeDataModels = False
        assert list(ssrs_source.yield_datamodel(MOCK_REPORTS[0])) == []

    def test_no_rdl_cached(self, ssrs_source):
        ssrs_source._current_rdl = None
        ssrs_source.client = MagicMock()
        ssrs_source.client.get_report_definition = MagicMock(return_value=None)
        ssrs_source.source_config.includeDataModels = True
        assert list(ssrs_source.yield_datamodel(MOCK_REPORTS[0])) == []


class TestSsrsLineage:
    def _prepare(self, ssrs_source, rdl, *, include_data_models=True):
        ssrs_source._current_rdl = (MOCK_REPORTS[0].id, rdl)
        ssrs_source.source_config.includeDataModels = include_data_models
        datamodel_entity = SimpleNamespace(
            id=SimpleNamespace(root="dm-uuid"), fullyQualifiedName=None
        )
        dashboard_entity = SimpleNamespace(
            id=SimpleNamespace(root="dash-uuid"), fullyQualifiedName=None
        )
        table_entity = SimpleNamespace(
            id=SimpleNamespace(root="tbl-uuid"), fullyQualifiedName=None
        )

        def by_name(entity, fqn=None, **_):
            if entity is DashboardDataModel:
                return datamodel_entity
            if entity is Dashboard:
                return dashboard_entity
            if entity is DatabaseService:
                return None
            return None

        ssrs_source.metadata = MagicMock()
        ssrs_source.metadata.get_by_name = MagicMock(side_effect=by_name)
        ssrs_source.metadata.search_in_any_service = MagicMock(
            return_value=table_entity
        )
        return datamodel_entity, dashboard_entity, table_entity

    def test_inline_datasource_yields_lineage(self, ssrs_source):
        datamodel, _, table = self._prepare(ssrs_source, RDL_SALES)
        lineage_calls = []

        def fake_lineage(to_entity=None, from_entity=None, sql=None, **_):
            lineage_calls.append({"to": to_entity, "from": from_entity, "sql": sql})
            return Either(right=SimpleNamespace(sql=sql))

        with patch(
            "metadata.ingestion.source.dashboard.ssrs.metadata.LineageParser"
        ) as mock_parser, patch.object(
            SsrsSource, "_get_add_lineage_request", staticmethod(fake_lineage)
        ):
            mock_parser.return_value.source_tables = ["dbo.Orders"]
            results = list(
                ssrs_source.yield_dashboard_lineage_details(
                    MOCK_REPORTS[0], db_service_prefix="my_mssql"
                )
            )
        assert len(results) == 1
        assert lineage_calls[0]["sql"] == "SELECT OrderId, CustomerName FROM dbo.Orders"
        assert lineage_calls[0]["to"] is datamodel
        assert lineage_calls[0]["from"] is table
        search_call = ssrs_source.metadata.search_in_any_service.call_args
        assert "SalesDB" in search_call.kwargs["fqn_search_string"]
        assert "dbo" in search_call.kwargs["fqn_search_string"]
        assert "Orders" in search_call.kwargs["fqn_search_string"]

    def test_multiple_prefixes_all_produce_lineage(self, ssrs_source):
        """Regression: base class calls yield_dashboard_lineage_details once per
        db_service_prefix. Evicting the RDL inside that method dropped lineage
        for every prefix after the first."""
        self._prepare(ssrs_source, RDL_SALES)
        captured_services = []

        def record(*, fqn_search_string, **_):
            captured_services.append(fqn_search_string.split(".", 1)[0])
            return SimpleNamespace(id=SimpleNamespace(root="t"))

        ssrs_source.metadata.search_in_any_service = MagicMock(side_effect=record)
        with patch(
            "metadata.ingestion.source.dashboard.ssrs.metadata.LineageParser"
        ) as mock_parser, patch.object(
            SsrsSource,
            "_get_add_lineage_request",
            staticmethod(lambda **_: Either(right=SimpleNamespace())),
        ):
            mock_parser.return_value.source_tables = ["dbo.Orders"]
            for prefix in ("service_a", "service_b", "service_c"):
                list(
                    ssrs_source.yield_dashboard_lineage_details(
                        MOCK_REPORTS[0], db_service_prefix=prefix
                    )
                )
        assert captured_services == ["service_a", "service_b", "service_c"]
        assert ssrs_source._current_rdl[0] == MOCK_REPORTS[0].id

    def test_single_entry_cache_displaces_previous_report(self, ssrs_source):
        """The cache is bounded to one entry by construction — fetching a new
        report's RDL evicts the previous one automatically."""
        self._prepare(ssrs_source, RDL_SALES)
        assert ssrs_source._current_rdl[0] == MOCK_REPORTS[0].id
        new_report = SsrsReport(
            Id="report-next",
            Name="Next",
            Path="/next",
            HasDataSources=True,
        )
        ssrs_source.client = MagicMock()
        ssrs_source.client.get_report_definition = MagicMock(return_value=None)
        ssrs_source._get_report_definition(new_report)
        assert ssrs_source._current_rdl is None

    def test_source_connection_error_propagates(self, ssrs_source):
        """Transient SSRS failures must propagate so mark-deleted does not drop
        entities during an outage."""
        ssrs_source._current_rdl = None
        ssrs_source.client = MagicMock()
        ssrs_source.client.get_report_definition = MagicMock(
            side_effect=SourceConnectionException("SSRS is down")
        )
        report = SsrsReport(
            Id="r-outage",
            Name="Outage",
            Path="/outage",
            HasDataSources=True,
        )
        with pytest.raises(SourceConnectionException):
            ssrs_source._get_report_definition(report)

    def test_skips_expression_command(self, ssrs_source):
        self._prepare(ssrs_source, RDL_EXPRESSION)
        with patch(
            "metadata.ingestion.source.dashboard.ssrs.metadata.LineageParser"
        ) as mock_parser:
            results = list(ssrs_source.yield_dashboard_lineage_details(MOCK_REPORTS[0]))
        assert results == []
        mock_parser.assert_not_called()

    def test_skips_stored_procedure(self, ssrs_source):
        self._prepare(ssrs_source, RDL_STORED_PROC)
        with patch(
            "metadata.ingestion.source.dashboard.ssrs.metadata.LineageParser"
        ) as mock_parser:
            results = list(ssrs_source.yield_dashboard_lineage_details(MOCK_REPORTS[0]))
        assert results == []
        mock_parser.assert_not_called()

    def test_skips_shared_dataset_reference(self, ssrs_source):
        rdl = SsrsReportDefinition(
            data_sources=[
                SsrsDataSource(name="Shared", shared_reference="/Shared/Src")
            ],
            data_sets=[
                SsrsDataSet(
                    name="SharedDS",
                    data_source_name="Shared",
                    command_type="Text",
                    command_text="SELECT * FROM dbo.X",
                    shared_reference="/Shared DataSets/Orders",
                )
            ],
        )
        self._prepare(ssrs_source, rdl)
        with patch(
            "metadata.ingestion.source.dashboard.ssrs.metadata.LineageParser"
        ) as mock_parser:
            results = list(ssrs_source.yield_dashboard_lineage_details(MOCK_REPORTS[0]))
        assert results == []
        mock_parser.assert_not_called()

    def test_skips_mdx_datasource(self, ssrs_source):
        self._prepare(ssrs_source, RDL_MDX)
        with patch(
            "metadata.ingestion.source.dashboard.ssrs.metadata.LineageParser"
        ) as mock_parser:
            results = list(ssrs_source.yield_dashboard_lineage_details(MOCK_REPORTS[0]))
        assert results == []
        mock_parser.assert_not_called()

    def test_parser_failure_for_one_dataset_does_not_block_others(self, ssrs_source):
        self._prepare(ssrs_source, RDL_MULTI)
        parser_expenses = MagicMock()
        parser_expenses.source_tables = ["dbo.Expenses"]
        captured = []

        def fake_lineage(to_entity=None, from_entity=None, sql=None, **_):
            captured.append(sql)
            return Either(right=SimpleNamespace(sql=sql))

        with patch(
            "metadata.ingestion.source.dashboard.ssrs.metadata.LineageParser",
            side_effect=[Exception("parse error"), parser_expenses],
        ), patch.object(
            SsrsSource, "_get_add_lineage_request", staticmethod(fake_lineage)
        ):
            results = list(ssrs_source.yield_dashboard_lineage_details(MOCK_REPORTS[0]))
        assert len(results) == 1
        assert captured == ["SELECT Category, Amount FROM dbo.Expenses"]

    def test_dialect_defaults_to_tsql(self, ssrs_source):
        self._prepare(ssrs_source, RDL_SALES)
        with patch(
            "metadata.ingestion.source.dashboard.ssrs.metadata.LineageParser"
        ) as mock_parser:
            mock_parser.return_value.source_tables = []
            list(ssrs_source.yield_dashboard_lineage_details(MOCK_REPORTS[0]))
        assert Dialect.TSQL in mock_parser.call_args.args

    def test_four_part_prefix_does_not_collapse_lineage(self, ssrs_source):
        """A dbServicePrefix with 4 dot-parts used to overwrite every source
        table with its last segment, collapsing all lineage to one target."""
        self._prepare(ssrs_source, RDL_MULTI)
        parser_revenue = MagicMock()
        parser_revenue.source_tables = ["dbo.Revenue"]
        parser_expenses = MagicMock()
        parser_expenses.source_tables = ["dbo.Expenses"]
        captured_tables = []

        def record(*, fqn_search_string, **_):
            captured_tables.append(fqn_search_string)
            return SimpleNamespace(id=SimpleNamespace(root="tbl"))

        ssrs_source.metadata.search_in_any_service = MagicMock(side_effect=record)
        with patch(
            "metadata.ingestion.source.dashboard.ssrs.metadata.LineageParser",
            side_effect=[parser_revenue, parser_expenses],
        ), patch.object(
            SsrsSource,
            "_get_add_lineage_request",
            staticmethod(lambda **_: Either(right=SimpleNamespace())),
        ):
            list(
                ssrs_source.yield_dashboard_lineage_details(
                    MOCK_REPORTS[0],
                    db_service_prefix="my_mssql.FinanceDB.dbo.OVERRIDE_TABLE",
                )
            )
        assert any("Revenue" in q for q in captured_tables)
        assert any("Expenses" in q for q in captured_tables)
        assert not any("OVERRIDE_TABLE" in q for q in captured_tables)

    def test_dialect_uses_data_provider_when_no_db_service(self, ssrs_source):
        rdl = SsrsReportDefinition(
            data_sources=[
                SsrsDataSource(
                    name="Oracle",
                    data_provider="ORACLE",
                    connect_string="Data Source=ora;Initial Catalog=ODB",
                    server="ora",
                    database="ODB",
                )
            ],
            data_sets=[
                SsrsDataSet(
                    name="Q",
                    data_source_name="Oracle",
                    command_type="Text",
                    command_text="SELECT * FROM ora_schema.things",
                    fields=[SsrsField(name="things")],
                )
            ],
        )
        self._prepare(ssrs_source, rdl)
        with patch(
            "metadata.ingestion.source.dashboard.ssrs.metadata.LineageParser"
        ) as mock_parser:
            mock_parser.return_value.source_tables = []
            list(ssrs_source.yield_dashboard_lineage_details(MOCK_REPORTS[0]))
        assert Dialect.ORACLE in mock_parser.call_args.args

    def test_no_rdl_yields_nothing(self, ssrs_source):
        ssrs_source._current_rdl = None
        ssrs_source.client = MagicMock()
        ssrs_source.client.get_report_definition = MagicMock(return_value=None)
        ssrs_source.source_config.includeDataModels = True
        assert list(ssrs_source.yield_dashboard_lineage_details(MOCK_REPORTS[0])) == []

    def test_falls_back_to_dashboard_target_when_datamodels_disabled(self, ssrs_source):
        _, dashboard_entity, _ = self._prepare(
            ssrs_source, RDL_SALES, include_data_models=False
        )
        captured = []

        def fake_lineage(to_entity=None, from_entity=None, sql=None, **_):
            captured.append(to_entity)
            return Either(right=SimpleNamespace())

        with patch(
            "metadata.ingestion.source.dashboard.ssrs.metadata.LineageParser"
        ) as mock_parser, patch.object(
            SsrsSource, "_get_add_lineage_request", staticmethod(fake_lineage)
        ):
            mock_parser.return_value.source_tables = ["dbo.Orders"]
            results = list(ssrs_source.yield_dashboard_lineage_details(MOCK_REPORTS[0]))
        assert len(results) == 1
        assert captured == [dashboard_entity]
        entity_classes = {
            call.kwargs.get("entity")
            for call in ssrs_source.metadata.get_by_name.call_args_list
        }
        assert Dashboard in entity_classes
        assert DashboardDataModel not in entity_classes
