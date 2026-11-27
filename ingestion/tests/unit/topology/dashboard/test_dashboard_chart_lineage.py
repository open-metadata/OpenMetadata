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
"""The shared dashboard topology draws one Dashboard -> Chart edge per chart the
server holds under the dashboard.

The server is the boundary faked here, with the bulk sink's semantics: the dashboard
written in this node is only readable once a ``Barrier`` has flushed the buffer.
"""

import uuid
from collections import Counter
from http import HTTPStatus
from json import dumps, loads
from time import sleep
from urllib.parse import unquote, urlsplit

import pytest
from requests import Response
from requests.exceptions import Timeout

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.step import Step
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.ometa_lineage import (
    OMetaDashboardChartLineageDrain,
    OMetaDashboardChartLineageRequest,
    OMetaLineageRequest,
)
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.sink.metadata_rest import MetadataRestSink, MetadataRestSinkConfig
from metadata.ingestion.source.dashboard.dashboard_service import (
    DashboardServiceSource,
    DashboardServiceTopology,
)
from metadata.ingestion.source.dashboard.looker.metadata import LookerSource
from metadata.ingestion.source.dashboard.metabase.metadata import MetabaseSource
from metadata.ingestion.source.dashboard.ssrs.metadata import SsrsSource
from metadata.utils.logger import get_log_name

SERVICE = "dashboard_svc"
CHARTS = ("revenue", "orders", "customers")


def _dashboard(charts: tuple[str, ...]) -> Dashboard:
    return Dashboard(
        id=uuid.uuid4(),
        name="sales",
        fullyQualifiedName=f"{SERVICE}.sales",
        service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        charts=EntityReferenceList(
            [
                EntityReference(id=uuid.uuid4(), type="chart", fullyQualifiedName=f"{SERVICE}.{chart}")
                for chart in charts
            ]
        ),
    )


class FakeServer:
    """Answers ``get_by_name`` the way the bulk sink makes it: the dashboard written in
    this node is only readable after a ``Barrier`` went down the stream."""

    accepts_dashboard_chart_lineage_intents = False

    def __init__(self, dashboard: Dashboard | None = None, error: Exception | None = None):
        self.dashboard = dashboard
        self.error = error
        self.flushed = False

    def get_by_name(self, entity, fqn, fields=None):
        if self.error:
            raise self.error
        if (
            self.flushed
            and self.dashboard
            and fqn == self.dashboard.fullyQualifiedName.root
            and "charts" in (fields or [])
        ):
            return self.dashboard
        return None


def _source(
    server: FakeServer,
    dashboard: str | None = "sales",
    override_lineage: bool = False,
    source_class: type[DashboardServiceSource] = SsrsSource,
    include_direct_chart_lineage: bool = True,
) -> DashboardServiceSource:
    source = source_class.__new__(source_class)
    source.metadata = server
    source.source_config = DashboardServiceMetadataPipeline(
        overrideLineage=override_lineage,
        includeDirectChartLineage=include_direct_chart_lineage,
    )
    source.context = TopologyContextManager(DashboardServiceTopology())
    source.context.get().upsert("dashboard_service", SERVICE)
    source.context.get().upsert("dashboard", dashboard)
    return source


def _drain(source: DashboardServiceSource) -> list:
    records = []
    for record in source.yield_dashboard_chart_lineage(None):
        if isinstance(record.right, Barrier):
            source.metadata.flushed = True
        records.append(record)
    return records


def _edges(records: list) -> list[tuple[str, str, LineageSource, bool]]:
    return [
        (
            record.right.lineage_request.edge.fromEntity.fullyQualifiedName,
            record.right.lineage_request.edge.toEntity.fullyQualifiedName,
            record.right.lineage_request.edge.lineageDetails.source,
            record.right.override_lineage,
        )
        for record in records
        if isinstance(record.right, OMetaLineageRequest)
    ]


class TestDashboardChartLineage:
    def test_the_stage_runs_right_after_the_dashboard_is_yielded(self):
        processors = [stage.processor for stage in DashboardServiceTopology().dashboard.stages]

        assert processors.index("yield_dashboard_chart_lineage") == processors.index("yield_dashboard") + 1

    def test_each_chart_under_the_dashboard_gets_one_edge_after_the_barrier(self):
        records = _drain(_source(FakeServer(_dashboard(CHARTS))))

        assert isinstance(records[0].right, Barrier)
        assert _edges(records) == [
            (f"{SERVICE}.sales", f"{SERVICE}.{chart}", LineageSource.DashboardLineage, False) for chart in CHARTS
        ]

    @pytest.mark.parametrize("source_class", [LookerSource, MetabaseSource], ids=["looker", "metabase"])
    def test_disabling_direct_chart_lineage_keeps_every_dashboard_to_chart_edge(self, source_class):
        records = _drain(
            _source(FakeServer(_dashboard(CHARTS)), source_class=source_class, include_direct_chart_lineage=False)
        )

        assert _edges(records) == [
            (f"{SERVICE}.sales", f"{SERVICE}.{chart}", LineageSource.DashboardLineage, False) for chart in CHARTS
        ]

    def test_override_lineage_is_carried_on_every_edge(self):
        records = _drain(_source(FakeServer(_dashboard(CHARTS)), override_lineage=True))

        assert [override for *_, override in _edges(records)] == [True, True, True]

    @pytest.mark.parametrize(
        "server",
        [FakeServer(), FakeServer(_dashboard(()))],
        ids=["dashboard-not-on-the-server", "dashboard-without-charts"],
    )
    def test_no_chart_under_the_dashboard_means_no_edge_and_no_error(self, server):
        records = _drain(_source(server))

        assert [type(record.right) for record in records] == [Barrier]
        assert all(record.left is None for record in records)

    def test_nothing_is_drawn_before_any_dashboard_was_yielded(self):
        assert _drain(_source(FakeServer(_dashboard(CHARTS)), dashboard=None)) == []

    def test_a_failed_lookup_is_reported_instead_of_raised(self):
        records = _drain(_source(FakeServer(error=RuntimeError("server unavailable"))))

        assert isinstance(records[0].right, Barrier)
        assert [record.left.name for record in records[1:]] == ["sales"]
        assert "server unavailable" in records[1].left.error

    def test_a_dashboard_that_fails_does_not_redraw_the_previous_dashboards_edges(self):
        """Runs the real dashboard node: `sales` is written, then `broken` fails in the
        connector before its request is built, so the context must not still name
        `sales` when the chart lineage stage runs for `broken`."""

        class TwoDashboards(SsrsSource):
            def get_dashboard(self):
                yield from ("sales", "broken")

            def yield_dashboard(self, dashboard_details):
                if dashboard_details == "broken":
                    yield Either(left=StackTraceError(name="broken", error="cannot build the request"))
                    return
                yield Either(right=CreateDashboardRequest(name="sales", service=SERVICE))

            def yield_tags(self, *_):
                return []

            def yield_dashboard_chart(self, *_):
                return []

            def yield_datamodel(self, *_):
                return []

            def yield_dashboard_lineage(self, *_):
                return []

            def yield_dashboard_usage(self, *_):
                return []

        source = _source(FakeServer(_dashboard(CHARTS)), dashboard=None, source_class=TwoDashboards)
        records = []
        for record in source.process_nodes([source.topology.dashboard]):
            if isinstance(record.right, Barrier):
                source.metadata.flushed = True
            records.append(record)

        assert [to_fqn for _, to_fqn, *_ in _edges(records)] == [f"{SERVICE}.{chart}" for chart in CHARTS]
        assert [record.left.name for record in records if record.left] == ["broken"]


BATCH_PATH = "/lineage/dashboardCharts/batch"


class RecordingCatalog:
    """An HTTP boundary holding committed dashboard membership and lineage between runs."""

    def __init__(self, capabilities_status=HTTPStatus.NO_CONTENT, delay=0):
        self.capabilities_status = capabilities_status
        self.delay = delay
        self.requests = []
        self.edges = {}
        self.charts = {}
        self.dashboards = {}
        self.denied_dashboards = set()
        self.rejected_dashboards = set()
        self.rejected_charts = set()
        self.failed_chart_edges = set()
        self.batch_status = HTTPStatus.OK
        self.missing_batch_result = False
        self.service = EntityReference(
            id=uuid.uuid5(uuid.NAMESPACE_DNS, SERVICE),
            type="dashboardService",
        ).model_dump(mode="json", exclude_none=True)

    def request(self, method, url, **kwargs):
        split_url = urlsplit(str(url))
        path = unquote(split_url.path).removeprefix("/api/v1")
        payload = kwargs.get("json")
        if payload is None and isinstance(kwargs.get("data"), str):
            payload = loads(kwargs["data"])
        status, body = self.respond(method, path, payload)
        self.requests.append((method, path, split_url.query, payload, status))
        if self.delay:
            sleep(self.delay)
        response = Response()
        response.status_code = status
        response.url = str(url)
        response.headers["Content-Type"] = "application/json"
        response._content = dumps(body).encode() if body is not None else b""
        return response

    def respond(self, method, path, payload):
        if method == "GET" and path == f"{BATCH_PATH}/capability":
            return self.capabilities_status, None
        if method == "PUT" and path in {"/dashboards/bulk", "/charts/bulk"}:
            return self.commit(path, payload)
        if method == "GET" and path.startswith("/dashboards/name/"):
            name = path.removeprefix("/dashboards/name/")
            if name in self.denied_dashboards:
                return HTTPStatus.FORBIDDEN, {"code": 403, "message": "dashboard access denied"}
            if name in self.dashboards:
                return HTTPStatus.OK, self.dashboards[name]
            return HTTPStatus.NOT_FOUND, {"code": 404}
        if method == "GET" and path.startswith("/lineage/getLineageEdge/"):
            pair = tuple(path.split("/")[-2:])
            return (HTTPStatus.OK, {"edge": self.edges[pair]}) if pair in self.edges else (404, {"code": 404})
        if method == "PUT" and path == "/lineage":
            edge = payload["edge"]
            self.edges[edge["fromEntity"]["id"], edge["toEntity"]["id"]] = edge["lineageDetails"]
            return HTTPStatus.OK, None
        if method == "PATCH" and path.startswith("/lineage/dashboard/"):
            return HTTPStatus.OK, None
        if method == "DELETE" and path.startswith("/lineage/chart/"):
            chart_id, _, source = path.split("/")[-3:]
            self.edges = {
                pair: value for pair, value in self.edges.items() if pair[1] != chart_id or value["source"] != source
            }
            return HTTPStatus.OK, None
        if method == "PUT" and path == BATCH_PATH:
            return self.create_edges(payload["pairs"])
        raise AssertionError(f"Unexpected request: {method} {path}")

    def commit(self, path, requests):
        accepted = []
        rejected = []
        for request in requests:
            name = request["name"]
            entity_fqn = f"{SERVICE}.{name}"
            entity_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, entity_fqn))
            if path == "/charts/bulk":
                if name in self.rejected_charts:
                    continue
                self.charts[entity_fqn] = {"id": entity_id, "type": "chart", "fullyQualifiedName": entity_fqn}
            else:
                if name in self.rejected_dashboards:
                    rejected.append(
                        {"request": entity_fqn, "status": HTTPStatus.BAD_REQUEST, "message": "dashboard rejected"}
                    )
                    continue
                self.dashboards[entity_fqn] = {
                    "id": entity_id,
                    "name": name,
                    "fullyQualifiedName": entity_fqn,
                    "service": self.service,
                    "charts": [self.charts[chart] for chart in request.get("charts", []) if chart in self.charts],
                }
            accepted.append({"request": entity_fqn, "status": HTTPStatus.OK})
        return HTTPStatus.OK, {
            "numberOfRowsProcessed": len(accepted),
            "numberOfRowsFailed": len(rejected),
            "successRequest": accepted,
            "failedRequest": rejected,
        }

    def create_edges(self, pairs):
        if self.batch_status != HTTPStatus.OK:
            return self.batch_status, {"code": self.batch_status}
        results = []
        for pair in pairs[1:] if self.missing_batch_result else pairs:
            key = (pair["dashboardId"], pair["chartId"])
            if key[1] in self.failed_chart_edges:
                results.append({**pair, "status": "failed", "errorCode": "notFound"})
                continue
            status = "present" if key in self.edges else "created"
            self.edges.setdefault(key, {"source": "DashboardLineage"})
            results.append({**pair, "status": status})
        return HTTPStatus.OK, {"results": results}


class CatalogDashboardSource(SsrsSource):
    def _iter(self):
        yield from self.process_nodes([self.topology.dashboard])

    def get_dashboard(self):
        yield from self.dashboards.items()

    def yield_dashboard_chart(self, dashboard_details):
        _, charts = dashboard_details
        for chart in charts:
            yield Either(right=CreateChartRequest(name=chart, service=SERVICE))

    def yield_dashboard(self, dashboard_details):
        name, charts = dashboard_details
        if name in self.broken_dashboards:
            yield Either(left=StackTraceError(name=name, error="cannot build the request"))
        else:
            yield Either(
                right=CreateDashboardRequest(
                    name=name, service=SERVICE, charts=[f"{SERVICE}.{chart}" for chart in charts]
                )
            )

    def yield_dashboard_lineage(self, dashboard_details):
        if self.ordinary_barrier:
            yield Either(right=Barrier(reason="dashboard_lineage_flush"))

    def yield_dashboard_extension(self, dashboard_details):
        return []

    def yield_datamodel(self, dashboard_details):
        return []


def run_dashboard_topology(
    catalog,
    dashboards,
    *,
    override=False,
    include_direct=True,
    ordinary_barrier=False,
    broken_dashboards=(),
    finish=True,
):
    metadata = OpenMetadata.__new__(OpenMetadata)
    metadata.client = REST(ClientConfig(base_url="https://catalog.example/api"))
    metadata.client._session.request = catalog.request
    metadata._use_raw_data = False
    source = _source(
        metadata,
        dashboard=None,
        override_lineage=override,
        source_class=CatalogDashboardSource,
        include_direct_chart_lineage=include_direct,
    )
    Step.__init__(source)
    source.dashboards = dashboards
    source.broken_dashboards = broken_dashboards
    source.ordinary_barrier = ordinary_barrier
    sink = MetadataRestSink(MetadataRestSinkConfig(), metadata)
    records = Counter()
    for record in source.run():
        if record is None:
            continue
        records[record.reason if isinstance(record, Barrier) else type(record).__name__] += 1
        sink.run(record)
        if not finish and records["dashboard_lineage_flush"] == 1:
            break
    sink.close()
    metadata.close()
    return sink.status, source.status.failures, records


@pytest.mark.parametrize("include_direct", [False, True])
def test_dashboard_chart_lineage_batches_only_committed_membership(include_direct):
    catalog = RecordingCatalog()
    catalog.rejected_charts.add("rejected")
    dashboards = {
        "sales": tuple(f"chart{index}" for index in range(101)) + ("rejected",),
        "broken": (),
        "operations": ("shared",),
        "empty": (),
    }

    status, source_errors, records = run_dashboard_topology(
        catalog,
        dashboards,
        include_direct=include_direct,
        broken_dashboards=("broken",),
    )

    batches = [
        payload["pairs"] for method, path, _, payload, _ in catalog.requests if method == "PUT" and path == BATCH_PATH
    ]
    assert [len(pairs) for pairs in batches] == [100, 2]
    assert records["dashboard_chart_lineage_flush"] == 0
    assert records["OMetaDashboardChartLineageRequest"] == 3
    assert records["OMetaDashboardChartLineageDrain"] == 1
    assert [error.name for error in source_errors] == ["broken"]
    assert not status.failures
    assert not any(path.startswith("/lineage/getLineageEdge/") for _, path, *_ in catalog.requests)
    assert (
        {(pair["dashboardId"], pair["chartId"]) for pairs in batches for pair in pairs}
        == {
            (dashboard["id"], chart["id"]) for dashboard in catalog.dashboards.values() for chart in dashboard["charts"]
        }
        == set(catalog.edges)
    )


@pytest.mark.parametrize(
    ("override", "capabilities_status"),
    [(False, HTTPStatus.NOT_FOUND), (False, HTTPStatus.METHOD_NOT_ALLOWED), (True, HTTPStatus.NO_CONTENT)],
)
def test_old_servers_and_override_keep_the_ordered_per_edge_flow(override, capabilities_status):
    catalog = RecordingCatalog(capabilities_status=capabilities_status)
    chart_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{SERVICE}.shared"))
    old_dashboard_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{SERVICE}.old"))
    manual_edge = (str(uuid.uuid4()), chart_id)
    catalog.edges[old_dashboard_id, chart_id] = {"source": "DashboardLineage"}
    catalog.edges[manual_edge] = {"source": "Manual"}

    status, errors, records = run_dashboard_topology(
        catalog,
        {"sales": ("shared",), "operations": ("shared",)},
        override=override,
    )

    assert not errors and not status.failures
    assert records["dashboard_chart_lineage_flush"] == 2
    edge_operations = [
        method
        for method, path, *_ in catalog.requests
        if (path.startswith("/lineage/") and not path.endswith("/capability")) or path == "/lineage"
    ]
    assert edge_operations == (["DELETE", "GET", "PUT", "GET", "PUT"] if override else ["GET", "PUT", "GET", "PUT"])
    assert (
        (old_dashboard_id, chart_id) in catalog.edges
        if not override
        else (old_dashboard_id, chart_id) not in catalog.edges
    )
    assert catalog.edges[manual_edge] == {"source": "Manual"}
    assert sum(path.endswith("/capability") for _, path, *_ in catalog.requests) == int(not override)


def test_dashboard_rejected_by_bulk_write_has_no_lineage_read_failure():
    catalog = RecordingCatalog()
    catalog.rejected_dashboards.add("rejected")
    rejected_fqn = f"{SERVICE}.rejected"

    status, errors, _ = run_dashboard_topology(catalog, {"rejected": ("chart",), "sales": ("chart",)})

    assert not errors
    assert rejected_fqn not in catalog.dashboards
    assert any(
        method == "GET" and path == f"/dashboards/name/{rejected_fqn}" and code == HTTPStatus.NOT_FOUND
        for method, path, _, _, code in catalog.requests
    )
    assert any("dashboard rejected" in failure.error for failure in status.failures)
    assert all(failure.name != rejected_fqn for failure in status.failures)
    assert len(catalog.edges) == 1


def test_a_failed_batch_item_and_dashboard_read_do_not_hide_successful_edges():
    catalog = RecordingCatalog()
    catalog.denied_dashboards.add(f"{SERVICE}.forbidden")
    catalog.failed_chart_edges.add(str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{SERVICE}.missing_chart")))

    status, errors, _ = run_dashboard_topology(
        catalog,
        {"forbidden": ("hidden",), "sales": ("missing_chart", "available")},
    )

    assert not errors
    assert len(catalog.edges) == 1
    assert [failure.name for failure in status.failures] == [
        f"{SERVICE}.forbidden",
        f"{SERVICE}.sales -> {SERVICE}.missing_chart",
    ]
    assert "notFound" in status.failures[1].error
    assert [record for record in status.records if " -> " in record] == [f"{SERVICE}.sales -> {SERVICE}.available"]


def test_an_unacknowledged_pair_is_failed_and_never_counted_as_scanned():
    catalog = RecordingCatalog()
    catalog.missing_batch_result = True

    status, errors, _ = run_dashboard_topology(catalog, {"sales": ("uncertain", "available")})

    assert not errors
    assert [failure.name for failure in status.failures] == [f"{SERVICE}.sales -> {SERVICE}.uncertain"]
    assert [record for record in status.records if " -> " in record] == [f"{SERVICE}.sales -> {SERVICE}.available"]


def test_an_ordinary_rerun_recovers_an_unacknowledged_batch(monkeypatch):
    catalog = RecordingCatalog()
    request = catalog.request

    def lose_response(method, url, **kwargs):
        response = request(method, url, **kwargs)
        if method == "PUT" and urlsplit(str(url)).path.endswith(BATCH_PATH):
            raise Timeout("response lost after commit")
        return response

    dashboards = {"sales": ("available",)}
    label = f"{SERVICE}.sales -> {SERVICE}.available"
    with monkeypatch.context() as context:
        context.setattr(catalog, "request", lose_response)
        first_status, _, _ = run_dashboard_topology(catalog, dashboards)

    assert label not in first_status.records
    assert [failure.name for failure in first_status.failures] == [label]
    assert len(catalog.edges) == 1
    stored_edges = catalog.edges.copy()

    next_status, _, _ = run_dashboard_topology(catalog, dashboards)

    assert label in next_status.records
    assert not next_status.failures
    assert catalog.edges == stored_edges


@pytest.mark.parametrize(
    "status_code", [HTTPStatus.FORBIDDEN, HTTPStatus.NOT_FOUND, HTTPStatus.TOO_MANY_REQUESTS, HTTPStatus.BAD_GATEWAY]
)
def test_a_failed_batch_does_not_switch_to_per_edge_requests(status_code):
    catalog = RecordingCatalog()
    catalog.batch_status = status_code

    status, errors, _ = run_dashboard_topology(catalog, {"sales": ("available",)})

    assert not errors
    assert len(status.failures) == 1
    assert status.failures[0].name == f"{SERVICE}.sales -> {SERVICE}.available"
    assert status.failures[0].error.removeprefix("Dashboard chart lineage batch failed: ")
    assert not any(" -> " in record for record in status.records)
    assert [(method, path) for method, path, *_ in catalog.requests if path.startswith("/lineage")] == [
        ("GET", f"{BATCH_PATH}/capability"),
        ("PUT", BATCH_PATH),
    ]


def test_capability_denial_is_checked_once_and_reported_without_fallback():
    catalog = RecordingCatalog(capabilities_status=HTTPStatus.FORBIDDEN)

    status, errors, _ = run_dashboard_topology(catalog, {"sales": ("shared",), "operations": ("shared",)})

    assert not status.failures
    assert [error.name for error in errors] == ["sales", "operations"]
    assert all("403" in error.error for error in errors)
    assert [(method, path) for method, path, *_ in catalog.requests if path.startswith("/lineage")] == [
        ("GET", f"{BATCH_PATH}/capability"),
    ]


def test_drain_reuses_existing_entity_flushes_and_honors_the_dashboard_limit():
    catalog = RecordingCatalog()
    dashboards = {f"dashboard{i}": () for i in range(101)}

    status, errors, records = run_dashboard_topology(catalog, dashboards, ordinary_barrier=True)

    assert not errors and not status.failures
    assert records["dashboard_lineage_flush"] == 101
    assert sum(method == "PUT" and path == "/dashboards/bulk" for method, path, *_ in catalog.requests) == 101
    dashboard_reads = [event for event in catalog.requests if event[1].startswith("/dashboards/name/")]
    assert len(dashboard_reads) == 101
    assert all(query == "fields=charts" for _, _, query, *_ in dashboard_reads)
    assert catalog.requests.index(dashboard_reads[0]) < next(
        index
        for index, (method, path, _, payload, _) in enumerate(catalog.requests)
        if method == "PUT" and path == "/dashboards/bulk" and payload[0]["name"] == "dashboard100"
    )


def test_closing_an_aborted_sink_discards_its_pending_dashboard_intents():
    catalog = RecordingCatalog()

    status, errors, _ = run_dashboard_topology(
        catalog, {"sales": ("chart",), "operations": ("chart",)}, ordinary_barrier=True, finish=False
    )

    assert not errors and not status.failures
    assert f"{SERVICE}.sales" in catalog.dashboards
    assert not catalog.edges


def test_dashboard_chart_lineage_control_records_are_excluded_from_scan_counts():
    assert get_log_name(OMetaDashboardChartLineageRequest(dashboard_fqn=f"{SERVICE}.sales")) is None
    assert get_log_name(OMetaDashboardChartLineageDrain()) is None
