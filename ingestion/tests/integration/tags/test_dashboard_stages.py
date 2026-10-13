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
"""Dashboard native tags persisted through the real backend and sink."""

from types import SimpleNamespace

import pytest
from looker_sdk.sdk.api40.models import LookmlModel, LookmlModelExplore, LookmlModelExploreFieldset

from metadata.generated.schema.api.services.createDashboardService import CreateDashboardServiceRequest
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.metric import Metric
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
)
from metadata.ingestion.api.steps import Source
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.sink.metadata_rest import MetadataRestSink
from metadata.ingestion.source.dashboard.grafana.metadata import GrafanaSource
from metadata.ingestion.source.dashboard.looker.measures import MeasureCandidate
from metadata.ingestion.source.dashboard.looker.metadata import LookerSource
from metadata.ingestion.source.dashboard.looker.models import LookMlView
from metadata.ingestion.source.dashboard.tableau.metadata import TableauSource
from metadata.ingestion.source.dashboard.tableau.models import DataSource, TableauChart, TableauDashboard

from ..conftest import _safe_delete  # noqa: TID252
from .test_workflow import _assert_workflow, _tag_catalog  # noqa: TID252


@pytest.mark.parametrize("case", ["fresh", "existing", "denied"])
def test_redash_native_tags_persist_through_workflow(metadata, request, monkeypatch, case):
    dashboards = [
        {"id": 1, "name": "First", "tags": ["Shared"], "widgets": []},
        {"id": 2, "name": "Second", "tags": ["Shared", "New"], "widgets": []},
    ]
    native_client = SimpleNamespace(
        dashboards=lambda **_: dashboards,
        paginate=lambda _: dashboards,
        get_dashboard=lambda name: dashboards[name - 1],
    )
    monkeypatch.setattr(
        "metadata.ingestion.source.dashboard.redash.connection.RedashApiClient", lambda _: native_client
    )
    with _tag_catalog(metadata, request, case, DashboardService) as (config, classification):
        monkeypatch.setattr("metadata.ingestion.source.dashboard.redash.metadata.REDASH_TAG_CATEGORY", classification)
        config["source"].update(
            {
                "type": "redash",
                "serviceConnection": {
                    "config": {
                        "type": "Redash",
                        "hostPort": "http://localhost:5000",
                        "apiKey": "testing",
                        "username": "testing",
                    }
                },
                "sourceConfig": {
                    "config": {
                        "type": "DashboardMetadata",
                        "includeTags": True,
                        "includeOwners": False,
                        "includeDataModels": False,
                        "includeUsage": False,
                        "markDeletedDashboards": False,
                        "markDeletedCharts": False,
                        "markDeletedDataModels": False,
                    }
                },
            }
        )
        service = config["source"]["serviceName"]
        _assert_workflow(
            metadata,
            config,
            Dashboard,
            {
                f"{service}.1": [f"{classification}.Shared"],
                f"{service}.2": [f"{classification}.Shared"] + ([] if case == "denied" else [f"{classification}.New"]),
            },
            expected_failures=2 if case == "denied" else 0,
        )


def stage_source(source_type, metadata, service):
    source = object.__new__(source_type)
    Source.__init__(source)
    source.metadata = metadata
    source.source_config = DashboardServiceMetadataPipeline(includeTags=True, includeOwners=False, includeMetrics=False)
    source.context = TopologyContextManager(source.topology)
    for key, value in (("dashboard_service", service), ("charts", []), ("dataModels", [])):
        source.context.get().upsert(key, value)
    source.dashboard_source_state = set()
    source.chart_source_state = set()
    source.datamodel_source_state = set()
    return source


def consume(sink, records):
    requests = []
    for record in records:
        assert record.left is None
        sink.run(record.right)
        requests.append(record.right)
    return requests


def assert_tags(metadata, entity_type, entity_fqn, expected):
    asset = metadata.get_by_name(entity=entity_type, fqn=entity_fqn, fields=["tags"])
    assert asset is not None
    assert sorted(label.tagFQN.root for label in asset.tags or []) == sorted(expected)


def test_grafana_persists_existing_labels_without_creating_missing_tags(metadata, request, monkeypatch):
    with _tag_catalog(metadata, request, "existing", DashboardService) as (config, classification):
        monkeypatch.setattr("metadata.ingestion.source.dashboard.grafana.metadata.GRAFANA_TAG_CATEGORY", classification)
        service = config["source"]["serviceName"]
        metadata.create_or_update(CreateDashboardServiceRequest(name=service, serviceType="Grafana"))
        source = stage_source(GrafanaSource, metadata, service)
        source.service_connection = SimpleNamespace(hostPort="http://localhost:3000")
        details = SimpleNamespace(
            dashboard=SimpleNamespace(
                uid="my_dashboard", title="My dashboard", description=None, tags=["Shared", "Missing"]
            ),
            meta=SimpleNamespace(url="/d/my_dashboard", createdBy=None),
        )
        assert list(source.yield_tags(details) or []) == []
        sink = MetadataRestSink.create({"bulk_sink_batch_size": 1}, metadata)
        try:
            consume(sink, source.yield_dashboard(details))
            sink.close()
            assert sink.get_status().failures == []
            assert_tags(metadata, Dashboard, f"{service}.my_dashboard", [f"{classification}.Shared"])
            assert metadata.get_by_name(entity=Tag, fqn=f"{classification}.Missing") is None
            assert source.tags_registry.stats()["pending"] == 0
            assert source.tags_registry.stats()["live_entities"] == 0
        finally:
            sink.close()


def test_tableau_dashboard_chart_and_model_labels_do_not_bleed_into_each_other(metadata, request, monkeypatch):
    with _tag_catalog(metadata, request, "fresh", DashboardService) as (config, classification):
        monkeypatch.setattr("metadata.ingestion.source.dashboard.tableau.metadata.TABLEAU_TAG_CATEGORY", classification)
        service = config["source"]["serviceName"]
        metadata.create_or_update(CreateDashboardServiceRequest(name=service, serviceType="Tableau"))
        source = stage_source(TableauSource, metadata, service)
        source.service_connection = SimpleNamespace(siteName="", hostPort="http://localhost:5000", proxyURL=None)
        source.config = SimpleNamespace(
            serviceConnection=SimpleNamespace(root=SimpleNamespace(config=source.service_connection))
        )
        source.client = SimpleNamespace(get_custom_sql_table_queries=lambda _: None)
        details = TableauDashboard(
            id="my_dashboard",
            name="My dashboard",
            webpageUrl="http://localhost:5000/#/workbooks/my_dashboard",
            tags={"Shared"},
            charts=[
                TableauChart(id="my_chart", name="My chart", contentUrl="my_workbook/sheets/my_chart", tags={"New"})
            ],
            dataModels=[
                DataSource(id="embedded", upstreamDatasources=[DataSource(id="published", tags=[{"name": "Shared"}])])
            ],
        )
        sink = MetadataRestSink.create({"bulk_sink_batch_size": 1}, metadata)
        try:
            consume(sink, source.yield_tags(details))
            consume(sink, source.yield_dashboard_chart(details))
            consume(sink, source.yield_datamodel(details))
            consume(sink, source.yield_dashboard(details))
            sink.close()
            assert sink.get_status().failures == []
            assert_tags(metadata, Dashboard, f"{service}.my_dashboard", [f"{classification}.Shared"])
            assert_tags(metadata, Chart, f"{service}.my_chart", [f"{classification}.New"])
            assert_tags(metadata, DashboardDataModel, f"{service}.model.embedded", [])
            assert_tags(metadata, DashboardDataModel, f"{service}.model.published", [f"{classification}.Shared"])
            assert source.tags_registry.stats()["live_entities"] == 0
        finally:
            sink.close()


def test_looker_explore_referenced_view_standalone_view_and_metric_tags_persist(metadata, request, monkeypatch):
    with _tag_catalog(metadata, request, "fresh", DashboardService) as (config, classification):
        monkeypatch.setattr("metadata.ingestion.source.dashboard.looker.metadata.LOOKER_TAG_CATEGORY", classification)
        service = config["source"]["serviceName"]
        metadata.create_or_update(CreateDashboardServiceRequest(name=service, serviceType="Looker"))
        source = stage_source(LookerSource, metadata, service)
        views = {
            "my_view": LookMlView(name="my_view", tags=["New"]),
            "standalone": LookMlView(name="standalone", tags=["Shared"]),
        }
        parser = SimpleNamespace(_views_cache=views, parsed_files={}, find_view=lambda view_name: views[view_name])
        source._project_parsers = {"my_project": parser}
        source._repo_credentials = object()
        source._all_lookml_models = [LookmlModel(name="my_model", project_name="my_project")]
        source.service_connection = SimpleNamespace(displayUrl=None, hostPort="http://localhost:5000")
        source._pending_explores = []
        source._pending_views = []
        source._pending_view_lineage = []
        source._pending_standalone_lineage = []
        source._processed_view_names = set()
        source._project_views_cache = {}
        source._explores_cache = {}
        source._metric_explores = {}
        candidate = MeasureCandidate(
            project="my_project",
            view="my_view",
            name="my_measure",
            label=None,
            description=None,
            measure_type="sum",
            sql=None,
            filters=[],
            value_format_name=None,
            tags=["New"],
            dimensions=[],
            from_lookml=True,
        )
        source._metric_candidates = {candidate.key: candidate}
        model = LookmlModelExplore(
            fields=LookmlModelExploreFieldset(dimensions=[], measures=[]),
            name="my_explore",
            model_name="my_model",
            project_name="my_project",
            tags=["Shared"],
            view_name="my_view",
            joins=[],
        )
        sink = MetadataRestSink.create({"bulk_sink_batch_size": 1}, metadata)
        metric_names = []
        try:
            consume(sink, source.yield_bulk_datamodel(model))
            consume(sink, source.yield_standalone_datamodels())
            source.source_config.includeMetrics = True
            metrics = consume(sink, source._yield_datamodel_metrics())
            metric_names = [record.name.root for record in metrics if hasattr(record, "measures")]
            sink.close()
            assert sink.get_status().failures == []
            assert_tags(
                metadata, DashboardDataModel, f"{service}.model.my_model_my_explore", [f"{classification}.Shared"]
            )
            assert_tags(
                metadata, DashboardDataModel, f"{service}.model.my_model_my_view_view", [f"{classification}.New"]
            )
            assert_tags(
                metadata, DashboardDataModel, f"{service}.model.my_model_standalone_view", [f"{classification}.Shared"]
            )
            assert len(metric_names) == 1
            assert_tags(metadata, Metric, metric_names[0], [f"{classification}.New"])
            assert source.tags_registry.stats()["live_entities"] == 0
        finally:
            sink.close()
            for name in metric_names:
                metric = metadata.get_by_name(entity=Metric, fqn=name)
                if metric is not None:
                    _safe_delete(metadata, Metric, metric.id, hard_delete=True)
