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
Hex components as charts, app views and run history as custom properties, and app views as usage.
The real Hex client and source run against fakes of the two HTTP boundaries: the Hex
API, answering in the shapes of its OpenAPI spec, and the OpenMetadata server.
"""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, call

import pytest
from requests import HTTPError

from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
)
from metadata.generated.schema.type.basic import EntityExtension, EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.customProperty import PropertyType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.usageDetails import UsageDetails, UsageStats
from metadata.ingestion.models.patch_request import (
    ALLOWED_COMMON_PATCH_FIELDS,
    RESTRICT_UPDATE_LIST,
    build_patch,
)
from metadata.ingestion.source.dashboard.hex.client import HexApiClient
from metadata.ingestion.source.dashboard.hex.metadata import HexSource
from metadata.ingestion.source.dashboard.hex.models import AppViews, ProjectAnalytics

SERVICE = "hex_service"
DAY_1, DAY_2 = "2026-11-02", "2026-11-03"

PROJECT = {
    "id": "proj_1",
    "title": "Revenue",
    "type": "PROJECT",
    "createdAt": "2026-01-01T00:00:00Z",
    "lastPublishedAt": "2026-10-01T00:00:00Z",
    "analytics": {
        "appViews": {"allTime": 500, "lastSevenDays": 10, "lastFourteenDays": 20, "lastThirtyDays": 40},
        "lastViewedAt": "2026-11-01T10:00:00Z",
        "publishedResultsUpdatedAt": "2026-11-01T06:00:00Z",
    },
}
DRAFT = {"id": "proj_2", "title": "Scratch", "type": "PROJECT"}
COMPONENT = {
    "id": "comp_1",
    "title": "Revenue by region",
    "description": "Bar chart",
    "type": "COMPONENT",
    "owner": {"email": "owner@example.com"},
    "lastPublishedAt": "2026-10-01T00:00:00Z",
}
FILTERED_COMPONENT = {"id": "comp_2", "title": "internal kpis", "type": "COMPONENT"}

# A component nested in a collapsible section, the filtered one, one not listed, and a repeat
EXPORT = """
cells:
  - cellType: SQL
    cellId: sql_1
    config: {source: "SELECT 1", resultVariableName: dataframe_1}
  - cellType: COLLAPSIBLE
    cellId: section_1
    config:
      cells:
        - cellType: COMPONENT_IMPORT
          cellId: import_1
          config: {component: {id: comp_1}}
  - cellType: COMPONENT_IMPORT
    cellId: import_2
    config: {component: {id: comp_2}}
  - cellType: COMPONENT_IMPORT
    cellId: import_3
    config: {component: {id: comp_unlisted}}
  - cellType: COMPONENT_IMPORT
    cellId: import_4
    config: {component: {id: comp_1}}
"""


# A team in OpenMetadata with the Hex owner's email
OWNER_TEAM = EntityReference(id=uuid.uuid4(), type="team", name="finance")


def run(run_id, status, start, end=None, elapsed_ms=None):
    return {
        "projectId": "proj_1",
        "runId": run_id,
        "status": status,
        "startTime": start,
        "endTime": end,
        "elapsedTime": elapsed_ms,
    }


class FakeHexRest:
    """The Hex API: runs are kept newest first, as Hex lists them"""

    def __init__(self, runs=()):
        self.runs = list(runs)
        self.calls = []

    def get(self, path, data=None):
        self.calls.append((path, dict(data or {})))
        if path == "/projects":
            return {"values": [PROJECT, DRAFT, COMPONENT, FILTERED_COMPONENT], "pagination": None}
        if path == "/users/me":
            return {"org": {"id": "ws"}}
        if path.endswith("/runs"):
            runs = [r for r in self.runs if r["status"] == data.get("statusFilter", r["status"])]
            return {"runs": runs[: data["limit"]], "nextPage": None, "previousPage": None, "traceId": "t"}
        raise AssertionError(f"Unexpected GET {path}")

    def post(self, path, json=None):
        self.calls.append((path, json))
        return {"content": EXPORT}


class FakeOpenMetadata:
    """The server: dashboards, daily usage added by PUT, and dashboard custom properties"""

    def __init__(self, properties=()):
        self.dashboard = Dashboard(
            id=uuid.uuid4(),
            name="proj_1",
            fullyQualifiedName=f"{SERVICE}.proj_1",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        )
        self.usage: dict[str, int] = {}
        self.properties = [{"name": name, "propertyType": {"name": data_type}} for name, data_type in properties]
        self.registered = []
        self.email_lookups = []

    def get_by_name(self, entity, fqn, fields=None):
        return self.dashboard if fqn == model_fqn(self.dashboard) else None

    def get_dashboard_usage(self, dashboard, date, days):
        last = datetime.fromisoformat(date).toordinal()
        return [
            UsageDetails(dailyStats=UsageStats(count=count), date=day)
            for day, count in self.usage.items()
            if 0 <= last - datetime.fromisoformat(day).toordinal() < days
        ]

    def publish(self, dashboard_usage):
        usage = dashboard_usage.usage
        self.usage[usage.date] = self.usage.get(usage.date, 0) + usage.count

    def get_entity_custom_properties(self, entity_type):
        return self.properties

    def get_property_type_ref(self, data_type):
        return PropertyType(EntityReference(id=uuid.uuid4(), type="type", name=data_type.value))

    def create_or_update_custom_property(self, record):
        request = record.createCustomPropertyRequest
        self.registered.append(request.name.root)
        self.properties.append({"name": request.name.root, "propertyType": {"name": request.propertyType.root.name}})

    def get_reference_by_email(self, email):
        self.email_lookups.append(email)
        return EntityReferenceList([OWNER_TEAM]) if email == COMPONENT["owner"]["email"] else None


def model_fqn(entity):
    return entity.fullyQualifiedName.root


@pytest.fixture
def make_source():
    def _make(runs=(), properties=(), include_custom_properties=True, include_owners=True):
        client = HexApiClient.__new__(HexApiClient)
        client.config = SimpleNamespace(hostPort="https://app.hex.tech")
        client.client = FakeHexRest(runs)
        source = HexSource.__new__(HexSource)
        source.client = client
        source.metadata = FakeOpenMetadata(properties)
        source.config = SimpleNamespace(serviceName=SERVICE)
        source.source_config = DashboardServiceMetadataPipeline(
            chartFilterPattern={"excludes": ["internal.*"]},
            includeCustomProperties=include_custom_properties,
            includeOwners=include_owners,
        )
        source.context = MagicMock()
        source.context.get.return_value = SimpleNamespace(dashboard_service=SERVICE, charts=None)
        source.status = MagicMock()
        source.chart_source_state = set()
        source.today = DAY_1
        source.components = {}
        source._custom_property_names = None
        return source

    return _make


def project(source, project_id="proj_1"):
    return next(item for item in source.get_dashboards_list() if item.id == project_id)


def patched_extension(source, item):
    """The extension the dashboard holds once the sink applies the stage's patch"""
    requests = [either.right for either in source.yield_dashboard_extension(item)]
    if not requests:
        return None
    (request,) = requests
    patch = build_patch(
        source=request.original_entity,
        destination=request.new_entity,
        allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
        restrict_update_fields=RESTRICT_UPDATE_LIST,
        override_metadata=request.override_metadata,
    )
    assert all(op["path"].startswith("/extension") and op["op"] != "remove" for op in patch.patch)
    stored = request.original_entity.model_dump(mode="json", exclude_none=True)
    return patch.apply(stored)["extension"]


class TestHexApiClient:
    def test_camel_case_project_fields_are_read(self, make_source):
        source = make_source()

        item = project(source)

        assert item.lastPublishedAt == datetime(2026, 10, 1, tzinfo=timezone.utc)
        assert item.analytics.appViews.lastSevenDays == 10
        assert item.analytics.lastViewedAt == datetime(2026, 11, 1, 10, tzinfo=timezone.utc)
        assert source.client.get_project_url(item) == "https://app.hex.tech/ws/app/proj_1"

    def test_projects_are_listed_with_their_components(self, make_source):
        source = make_source()

        assert [item.id for item in source.get_dashboards_list()] == ["proj_1", "proj_2"]
        assert set(source.components) == {"comp_1", "comp_2"}
        assert source.client.client.calls[0] == ("/projects", {"includeComponents": "true", "limit": 100})

    def test_cells_and_components_share_one_export(self, make_source):
        client = make_source().client

        assert [cell.id for cell in client.get_project_cells("proj_1")] == ["sql_1"]
        assert client.get_component_ids("proj_1") == ["comp_1", "comp_2", "comp_unlisted"]
        assert [call for call in client.client.calls if call[0] == "/projects/export"] == [
            ("/projects/export", {"projectId": "proj_1"})
        ]

    def test_components_are_unknown_when_the_export_fails(self, make_source):
        client = make_source().client
        client.client.post = MagicMock(side_effect=ConnectionError("down"))

        assert client.get_component_ids("proj_1") is None
        assert client.get_project_cells("proj_1") is None
        client.client.post.assert_called_once()

    def test_no_components_when_the_token_cannot_export(self, make_source):
        client = make_source().client
        client.client.post = MagicMock(side_effect=HTTPError(response=SimpleNamespace(status_code=403)))

        assert client.get_component_ids("proj_1") == []


class TestComponentsAsCharts:
    def test_imported_components_become_charts(self, make_source):
        source = make_source()
        item = project(source)

        charts = [either.right for either in source.yield_dashboard_chart(item)]

        assert [(chart.service.root, chart.name.root) for chart in charts] == [(SERVICE, "comp_1")]
        (chart,) = charts
        assert chart.displayName == "Revenue by region"
        assert chart.description.root == "Bar chart"
        assert chart.chartType == ChartType.Other
        assert chart.sourceUrl.root == "https://app.hex.tech/ws/app/comp_1"
        assert source.chart_source_state == {f"{SERVICE}.comp_1"}
        source.status.filter.assert_called_once_with("internal kpis", "Chart filtered out.")

    def test_owner_is_whoever_has_the_hex_owner_email(self, make_source):
        source = make_source()

        (chart,) = [either.right for either in source.yield_dashboard_chart(project(source))]

        assert chart.owners.root == [OWNER_TEAM]

    def test_no_owners_when_not_included(self, make_source):
        source = make_source(include_owners=False)

        (chart,) = [either.right for either in source.yield_dashboard_chart(project(source))]

        assert chart.owners is None
        assert source.metadata.email_lookups == []

    def test_failed_export_keeps_the_existing_charts(self, make_source):
        source = make_source()
        item = project(source)
        source.metadata.dashboard.charts = EntityReferenceList(
            [EntityReference(id=uuid.uuid4(), type="chart", name="comp_1")]
        )
        source.client.client.post = MagicMock(side_effect=ConnectionError("down"))

        charts = [either.right for either in source.yield_dashboard_chart(item)]

        assert [chart.name.root for chart in charts] == ["comp_1"]
        assert source.chart_source_state == {f"{SERVICE}.comp_1"}

    def test_a_failed_listing_page_keeps_the_charts_of_unlisted_components(self, make_source):
        source = make_source()
        listing = source.client.client.get
        pages = iter([{"values": [PROJECT, DRAFT], "pagination": {"after": "page_2"}}, ConnectionError("down")])

        def get(path, data=None):
            if path != "/projects":
                return listing(path, data)
            page = next(pages)
            if isinstance(page, Exception):
                raise page
            return page

        source.client.client.get = get
        source.metadata.dashboard.charts = EntityReferenceList(
            [EntityReference(id=uuid.uuid4(), type="chart", name="comp_1")]
        )
        source._get_dashboard_tags = MagicMock(return_value=None)
        source.register_record = MagicMock()
        source.source_config.includeDataModels = False
        item = project(source)

        assert list(source.yield_dashboard_chart(item)) == []
        (dashboard,) = source.yield_dashboard(item)

        assert [chart.root for chart in dashboard.right.charts] == [f"{SERVICE}.comp_1"]
        assert source.chart_source_state == {f"{SERVICE}.comp_1"}

    def test_dashboard_life_cycle(self, make_source):
        source = make_source()
        source._get_dashboard_tags = MagicMock(return_value=None)
        source.register_record = MagicMock()
        source.source_config.includeDataModels = False

        (either,) = source.yield_dashboard(project(source))

        life_cycle = either.right.lifeCycle
        assert life_cycle.created.timestamp.root == 1767225600000
        assert life_cycle.updated.timestamp.root == 1793512800000
        assert life_cycle.accessed.timestamp.root == 1793527200000
        (draft,) = source.yield_dashboard(project(source, "proj_2"))
        assert draft.right.lifeCycle is None


class TestAppViewsAsUsage:
    def test_percentiles_are_computed_on_close_only_with_usage(self, make_source):
        for include_usage, expected in ((True, [call(Dashboard, DAY_1)]), (False, [])):
            source = make_source()
            source.source_config.includeUsage = include_usage
            source._connection = None
            source.metadata.compute_percentile = MagicMock()
            source.metadata.close = MagicMock()

            source.close()

            assert source.metadata.compute_percentile.call_args_list == expected

    def ingest(self, source, week_views, today):
        source.today = today
        item = project(source)
        item.analytics.appViews.lastSevenDays = week_views
        sent = [either.right for either in source.yield_dashboard_usage(item)]
        for usage in sent:
            source.metadata.publish(usage)
        return [usage.usage.count for usage in sent]

    def test_weekly_usage_follows_hex(self, make_source):
        source = make_source()

        assert self.ingest(source, 10, DAY_1) == [10]
        assert self.ingest(source, 10, DAY_1) == []
        assert self.ingest(source, 12, DAY_1) == [2]
        assert self.ingest(source, 15, DAY_2) == [3]
        assert self.ingest(source, 5, DAY_2) == []
        assert source.metadata.usage == {DAY_1: 12, DAY_2: 3}

    def test_views_that_age_out_still_write_the_day(self, make_source):
        source = make_source()
        week_later = "2026-11-10"

        assert self.ingest(source, 10, DAY_1) == [10]
        assert self.ingest(source, 0, week_later) == [0]
        assert self.ingest(source, 0, week_later) == []
        assert source.metadata.usage == {DAY_1: 10, week_later: 0}

    def test_no_usage_without_app_views(self, make_source):
        source = make_source()

        assert list(source.yield_dashboard_usage(project(source, "proj_2"))) == []


VIEWS = {"appViewsLast7Days": 10, "appViewsAllTime": 500}


class TestCustomProperties:
    def test_app_views_last_run_and_last_refresh(self, make_source):
        source = make_source(
            runs=[
                run("r3", "ERRORED", "2026-11-02T08:00:00Z", "2026-11-02T08:00:05Z", 5400),
                run("r2", "COMPLETED", "2026-11-01T08:00:00Z", "2026-11-01T08:02:00Z", 120000),
            ]
        )
        source.metadata.dashboard.extension = EntityExtension({"team": "finance", "lastRunStatus": "COMPLETED"})

        extension = patched_extension(source, project(source))

        assert extension == {
            "team": "finance",
            **VIEWS,
            "lastRunStatus": "ERRORED",
            "lastRunElapsedSeconds": 5,
            "lastRefreshed": 1793520120000,
        }
        assert source.metadata.registered == [
            "appViewsLast7Days",
            "appViewsAllTime",
            "lastRunStatus",
            "lastRunElapsedSeconds",
            "lastRefreshed",
        ]

    def test_completed_latest_run_is_the_last_refresh(self, make_source):
        source = make_source(runs=[run("r1", "COMPLETED", "2026-11-01T08:00:00Z", None, None)])

        extension = patched_extension(source, project(source))

        assert extension == {**VIEWS, "lastRunStatus": "COMPLETED", "lastRefreshed": 1793520000000}
        assert [path for path, _ in source.client.client.calls if path.endswith("/runs")] == ["/projects/proj_1/runs"]

    def test_property_of_another_type_is_left_alone(self, make_source):
        source = make_source(
            runs=[run("r1", "COMPLETED", "2026-11-01T08:00:00Z", None, 1000)],
            properties=[("lastRunStatus", "enum"), ("lastRefreshed", "timestamp")],
        )

        extension = patched_extension(source, project(source))

        assert extension == {**VIEWS, "lastRunElapsedSeconds": 1, "lastRefreshed": 1793520000000}
        assert source.metadata.registered == ["appViewsLast7Days", "appViewsAllTime", "lastRunElapsedSeconds"]

    def test_published_project_without_runs_gets_its_views(self, make_source):
        source = make_source()

        assert patched_extension(source, project(source)) == VIEWS

    def test_unpublished_project_gets_views_without_reading_runs(self, make_source):
        source = make_source(runs=[run("r1", "COMPLETED", "2026-11-01T08:00:00Z")])
        draft = project(source, "proj_2")
        source.metadata.dashboard = source.metadata.dashboard.model_copy(
            update={"name": EntityName("proj_2"), "fullyQualifiedName": FullyQualifiedEntityName(f"{SERVICE}.proj_2")}
        )
        assert patched_extension(source, draft) is None

        draft.analytics = ProjectAnalytics(appViews=AppViews(lastSevenDays=0, allTime=3))
        assert patched_extension(source, draft) == {"appViewsLast7Days": 0, "appViewsAllTime": 3}
        assert not [path for path, _ in source.client.client.calls if path.endswith("/runs")]

    def test_nothing_without_the_flag(self, make_source):
        source = make_source(runs=[run("r1", "COMPLETED", "2026-11-01T08:00:00Z")], include_custom_properties=False)

        assert patched_extension(source, project(source)) is None
        assert not [path for path, _ in source.client.client.calls if path.endswith("/runs")]
        assert source.metadata.registered == []
