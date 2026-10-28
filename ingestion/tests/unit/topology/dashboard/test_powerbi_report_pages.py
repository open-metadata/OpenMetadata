#  Copyright 2026 Collate
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
PowerBI report pages and dashboard tiles -> Chart entities, driven through the real producer, chart stage
and dashboard stage.
"""

import copy
import uuid
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.services.ingestionPipelines.status import StackTraceError
from metadata.generated.schema.metadataIngestion.workflow import OpenMetadataWorkflowConfig
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.dashboard.powerbi.client import PowerBiApiClient, PowerBiClient
from metadata.ingestion.source.dashboard.powerbi.metadata import PowerbiSource
from metadata.ingestion.source.dashboard.powerbi.models import Group, PowerBIDashboard, PowerBIReport, Tile

SERVICE = "powerbi_report_pages_test"
WORKSPACE_ID = "ws-1"
WORKSPACE_URL = f"https://app.powerbi.com/groups/{WORKSPACE_ID}"

CONFIG = {
    "source": {
        "type": "powerbi",
        "serviceName": SERVICE,
        "serviceConnection": {
            "config": {
                "type": "PowerBI",
                "clientId": "client_id",
                "clientSecret": "secret",
                "tenantId": "tenant_id",
            }
        },
        "sourceConfig": {"config": {"type": "DashboardMetadata", "includeOwners": False}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}


def pages_path(report_id: str) -> str:
    return f"/myorg/groups/{WORKSPACE_ID}/reports/{report_id}/pages"


def pages_body(*pages: tuple[str | None, str]) -> dict:
    """A Get Pages In Group response: https://learn.microsoft.com/en-us/rest/api/power-bi/reports/get-pages-in-group"""
    return {
        "@odata.context": f"https://api.powerbi.com/v1.0/myorg/groups/{WORKSPACE_ID}/$metadata#pages",
        "value": [
            {"name": name, "displayName": display_name, "order": order}
            for order, (name, display_name) in enumerate(pages)
        ],
    }


@pytest.fixture
def make_source():
    """A real source whose Power BI REST GET answers from `responses`, keyed by path.

    A missing path answers None, which is what the REST client returns for an error status.
    `stored_charts` maps a report id to the chart names the server already lists under it.
    """

    @patch("metadata.ingestion.source.dashboard.powerbi.client.msal")
    @patch("metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection")
    @patch("metadata.ingestion.source.dashboard.dashboard_service.create_connection")
    def build(create_connection, test_connection, _msal, responses: dict, stored_charts=None, **source_config):
        create_connection.return_value.client = False
        test_connection.return_value = False
        config = copy.deepcopy(CONFIG)
        config["source"]["sourceConfig"]["config"].update(source_config)
        workflow_config = OpenMetadataWorkflowConfig.model_validate(config)
        source = PowerbiSource.create(
            config["source"], OpenMetadata(workflow_config.workflowConfig.openMetadataServerConfig)
        )
        source.context.get().__dict__["dashboard_service"] = SERVICE
        # Class attributes on the base source, so every instance in the process would share them.
        source.chart_source_state = set()
        source.dashboard_source_state = set()

        def get(path, *_, **__):
            response = responses.get(path)
            if isinstance(response, Exception):
                raise response
            return copy.deepcopy(response)

        api_client = PowerBiApiClient(source.service_connection)
        api_client.client = MagicMock()
        api_client.client.get.side_effect = get
        source.client = PowerBiClient(api_client=api_client, file_client=None)
        source.metadata.get_by_name = lambda entity, fqn, fields=None, **_: stored_report(fqn, stored_charts or {})
        return source

    return build


def stored_report(report_fqn: str, stored_charts: dict) -> Dashboard | None:
    """The report the server holds for `report_fqn`, as `get_by_name(Dashboard, fields=["charts"])` returns it."""
    report_id = report_fqn.rsplit(".", 1)[-1]
    charts = stored_charts.get(report_id)
    if isinstance(charts, Exception):
        raise charts
    if charts is None:
        return None
    return Dashboard(
        id=uuid.uuid4(),
        name=report_id,
        service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        charts=EntityReferenceList(
            root=[
                EntityReference(id=uuid.uuid4(), type="chart", name=name, fullyQualifiedName=f"{SERVICE}.{name}")
                for name in charts
            ]
        ),
    )


def requested_paths(source: PowerbiSource) -> list[str]:
    return [call.args[0] for call in source.client.api_client.client.get.call_args_list]


def ingest(
    source: PowerbiSource, *items: PowerBIReport | PowerBIDashboard, errors: list[StackTraceError] | None = None
) -> tuple[dict[str, CreateChartRequest], dict[str, CreateDashboardRequest]]:
    """Run one workspace through the real producer, then its chart and dashboard stages in topology order.

    Chart errors are appended to `errors` when it is given.
    """
    workspace = Group(
        id=WORKSPACE_ID,
        name="Sales",
        reports=[item for item in items if isinstance(item, PowerBIReport)],
        dashboards=[item for item in items if isinstance(item, PowerBIDashboard)],
    )
    source._prepare_workspace_data = lambda: iter([workspace])
    charts, dashboards = {}, {}
    for produced in source.get_dashboard():
        chart_results = list(source.yield_dashboard_chart(produced))
        charts = {model_str(either.right.name): either.right for either in chart_results if either.right is not None}
        if errors is not None:
            errors.extend(either.left for either in chart_results if either.left is not None)
        dashboards = {
            model_str(either.right.name): either.right
            for either in source.yield_dashboard(produced)
            if either.right is not None
        }
    return charts, dashboards


def chart_fqns(dashboard: CreateDashboardRequest) -> list[str]:
    return [model_str(chart) for chart in dashboard.charts or []]


def test_report_pages_become_charts_of_the_report(make_source):
    source = make_source(
        responses={pages_path("report-a"): pages_body(("ReportSection", "Overview"), ("ReportSection1", "Details"))}
    )

    charts, dashboards = ingest(source, PowerBIReport(id="report-a", name="Sales Report"))

    assert {name: (chart.displayName, model_str(chart.sourceUrl)) for name, chart in charts.items()} == {
        "report-a_ReportSection": ("Overview", f"{WORKSPACE_URL}/reports/report-a/ReportSection?experience=power-bi"),
        "report-a_ReportSection1": ("Details", f"{WORKSPACE_URL}/reports/report-a/ReportSection1?experience=power-bi"),
    }
    assert chart_fqns(dashboards["report-a"]) == [
        f"{SERVICE}.report-a_ReportSection",
        f"{SERVICE}.report-a_ReportSection1",
    ]
    assert source.chart_source_state == {f"{SERVICE}.report-a_ReportSection", f"{SERVICE}.report-a_ReportSection1"}


def test_report_url_is_built_from_the_one_pages_call(make_source):
    source = make_source(
        responses={pages_path("report-a"): pages_body(("ReportSection", "Overview"), ("ReportSection1", "Details"))}
    )

    _, dashboards = ingest(source, PowerBIReport(id="report-a", name="Sales Report"))

    assert model_str(dashboards["report-a"].sourceUrl) == (
        f"{WORKSPACE_URL}/reports/report-a/ReportSection?experience=power-bi"
    )
    assert requested_paths(source) == [pages_path("report-a")]


def test_reports_sharing_a_page_name_get_distinct_charts(make_source):
    source = make_source(
        responses={
            pages_path("report-a"): pages_body(("ReportSection", "Overview")),
            pages_path("report-b"): pages_body(("ReportSection", "Overview")),
        }
    )

    charts, dashboards = ingest(
        source, PowerBIReport(id="report-a", name="Report A"), PowerBIReport(id="report-b", name="Report B")
    )

    assert sorted(charts) == ["report-a_ReportSection", "report-b_ReportSection"]
    assert chart_fqns(dashboards["report-a"]) == [f"{SERVICE}.report-a_ReportSection"]
    assert chart_fqns(dashboards["report-b"]) == [f"{SERVICE}.report-b_ReportSection"]


def test_filtered_out_page_is_not_a_chart_but_the_report_still_opens_on_it(make_source):
    source = make_source(
        responses={pages_path("report-a"): pages_body(("ReportSection", "Overview"), ("ReportSection1", "Details"))},
        chartFilterPattern={"excludes": ["Overview"]},
    )

    charts, dashboards = ingest(source, PowerBIReport(id="report-a", name="Sales Report"))

    assert list(charts) == ["report-a_ReportSection1"]
    assert chart_fqns(dashboards["report-a"]) == [f"{SERVICE}.report-a_ReportSection1"]
    assert model_str(dashboards["report-a"].sourceUrl) == (
        f"{WORKSPACE_URL}/reports/report-a/ReportSection?experience=power-bi"
    )


def test_page_without_a_name_is_skipped(make_source):
    source = make_source(
        responses={pages_path("report-a"): pages_body((None, "Untitled"), ("ReportSection1", "Details"))}
    )

    charts, dashboards = ingest(source, PowerBIReport(id="report-a", name="Sales Report"))

    assert list(charts) == ["report-a_ReportSection1"]
    assert chart_fqns(dashboards["report-a"]) == [f"{SERVICE}.report-a_ReportSection1"]


def test_report_without_pages_lets_its_stored_charts_go(make_source):
    """An answer with no pages is the report's real state, so markDeletedCharts may remove its old page charts."""
    source = make_source(
        responses={pages_path("report-a"): pages_body()}, stored_charts={"report-a": ["report-a_ReportSection"]}
    )

    charts, dashboards = ingest(source, PowerBIReport(id="report-a", name="Sales Report"))

    assert charts == {}
    assert chart_fqns(dashboards["report-a"]) == []
    assert source.chart_source_state == set()
    assert model_str(dashboards["report-a"].sourceUrl) == f"{WORKSPACE_URL}/reports/report-a?experience=power-bi"
    assert requested_paths(source) == [pages_path("report-a")]


@pytest.mark.parametrize("response", [None, ConnectionError("connection reset")], ids=["error-status", "network-error"])
def test_failed_pages_read_keeps_the_report_stored_charts(make_source, response):
    """Without the pages, the run must neither soft-delete the report's page charts nor empty its charts."""
    stored = ["report-a_ReportSection", "report-a_ReportSection1"]
    source = make_source(responses={pages_path("report-a"): response}, stored_charts={"report-a": stored})

    charts, dashboards = ingest(source, PowerBIReport(id="report-a", name="Sales Report"))

    assert charts == {}
    assert chart_fqns(dashboards["report-a"]) == [f"{SERVICE}.{name}" for name in stored]
    assert source.chart_source_state == {f"{SERVICE}.{name}" for name in stored}
    assert model_str(dashboards["report-a"].sourceUrl) == f"{WORKSPACE_URL}/reports/report-a?experience=power-bi"
    assert requested_paths(source) == [pages_path("report-a")]


def test_failed_pages_read_of_a_report_not_ingested_yet_keeps_nothing(make_source):
    source = make_source(responses={})
    errors = []

    charts, dashboards = ingest(source, PowerBIReport(id="report-a", name="Sales Report"), errors=errors)

    assert errors == []
    assert charts == {}
    assert chart_fqns(dashboards["report-a"]) == []
    assert source.chart_source_state == set()


def test_report_whose_charts_cannot_be_read_is_left_as_stored(make_source):
    """Without its pages or its stored charts, sending the report would empty its charts and the
    stale-chart pass would soft-delete them, so the report is not sent and the pass is skipped."""
    source = make_source(responses={}, stored_charts={"report-a": ConnectionError("server unreachable")})
    errors = []

    _, dashboards = ingest(source, PowerBIReport(id="report-a", name="Sales Report"), errors=errors)

    assert [error.name for error in errors] == ["Sales Report"]
    assert dashboards == {}
    assert source.dashboard_source_state == {f"{SERVICE}.report-a"}
    with patch("metadata.ingestion.source.dashboard.dashboard_service.delete_entity_from_source") as delete:
        assert list(source.mark_charts_as_deleted()) == []
    delete.assert_not_called()


def test_stale_chart_pass_deletes_against_the_charts_ingested_this_run(make_source):
    source = make_source(responses={pages_path("report-a"): pages_body(("ReportSection", "Overview"))})

    ingest(source, PowerBIReport(id="report-a", name="Sales Report"))
    with patch(
        "metadata.ingestion.source.dashboard.dashboard_service.delete_entity_from_source", return_value=iter(())
    ) as delete:
        list(source.mark_charts_as_deleted())

    assert delete.call_args.kwargs["entity_source_state"] == {f"{SERVICE}.report-a_ReportSection"}


def test_unreadable_stored_charts_are_reported_and_the_next_report_still_ingested(make_source):
    source = make_source(
        responses={pages_path("report-b"): pages_body(("ReportSection", "Overview"))},
        stored_charts={"report-a": ConnectionError("server unreachable")},
    )
    errors = []

    charts, dashboards = ingest(
        source,
        PowerBIReport(id="report-a", name="Report A"),
        PowerBIReport(id="report-b", name="Report B"),
        errors=errors,
    )

    assert [error.name for error in errors] == ["Report A"]
    assert list(charts) == ["report-b_ReportSection"]
    assert list(dashboards) == ["report-b"]
    assert source.dashboard_source_state == {f"{SERVICE}.report-a", f"{SERVICE}.report-b"}


def test_paginated_report_pages_use_the_rdl_prefix(make_source):
    source = make_source(responses={pages_path("report-a"): pages_body(("ReportSection", "Overview"))})

    charts, dashboards = ingest(source, PowerBIReport(id="report-a", name="Invoice", format="RDL"))

    rdl_page_url = f"{WORKSPACE_URL}/rdlreports/report-a/ReportSection?experience=power-bi"
    assert model_str(charts["report-a_ReportSection"].sourceUrl) == rdl_page_url
    assert model_str(dashboards["report-a"].sourceUrl) == rdl_page_url


def test_filtered_out_report_fetches_no_pages(make_source):
    source = make_source(
        responses={pages_path("report-a"): pages_body(("ReportSection", "Overview"))},
        dashboardFilterPattern={"excludes": ["Sales Report"]},
    )

    charts, dashboards = ingest(source, PowerBIReport(id="report-a", name="Sales Report"))

    assert charts == {}
    assert dashboards == {}
    assert requested_paths(source) == []


def test_failed_page_chart_is_reported_and_left_out_of_the_report(make_source):
    """The server resolves every chart a report lists, so listing a chart it never got fails the report."""
    too_long_page_name = "p" * 256
    source = make_source(
        responses={pages_path("report-a"): pages_body((too_long_page_name, "Broken"), ("ReportSection1", "Details"))}
    )
    errors = []

    charts, dashboards = ingest(source, PowerBIReport(id="report-a", name="Sales Report"), errors=errors)

    assert [error.name for error in errors] == ["Broken"]
    assert list(charts) == ["report-a_ReportSection1"]
    assert chart_fqns(dashboards["report-a"]) == [f"{SERVICE}.report-a_ReportSection1"]


def test_failed_tile_without_a_title_is_reported_by_its_id(make_source):
    too_long_tile_id = "t" * 257
    source = make_source(responses={})
    dashboard = PowerBIDashboard(
        id="dash-a", displayName="Executive", tiles=[Tile(id=too_long_tile_id), Tile(id="tile-b", title="Revenue")]
    )
    errors = []

    charts, dashboards = ingest(source, dashboard, errors=errors)

    assert [error.name for error in errors] == [too_long_tile_id]
    assert list(charts) == ["tile-b"]
    assert chart_fqns(dashboards["dash-a"]) == [f"{SERVICE}.tile-b"]


def test_dashboard_tiles_and_report_pages_in_one_workspace(make_source):
    source = make_source(responses={pages_path("report-a"): pages_body(("ReportSection", "Overview"))})
    dashboard = PowerBIDashboard(
        id="dash-a", displayName="Executive", tiles=[Tile(id="tile-a", title="Revenue", reportId="report-a")]
    )

    charts, dashboards = ingest(source, PowerBIReport(id="report-a", name="Sales Report"), dashboard)

    assert sorted(charts) == ["report-a_ReportSection", "tile-a"]
    assert model_str(charts["tile-a"].sourceUrl) == f"{WORKSPACE_URL}/reports/report-a"
    assert chart_fqns(dashboards["dash-a"]) == [f"{SERVICE}.tile-a"]
    assert chart_fqns(dashboards["report-a"]) == [f"{SERVICE}.report-a_ReportSection"]
    assert requested_paths(source) == [pages_path("report-a")]
