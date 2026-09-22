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
Metric emission through the real Looker bulk data-model stage.

``test_looker_measures`` covers the LookML -> Metric mapping in isolation. This exercises the
wiring: when metrics are emitted relative to the Barrier, what ends up in ``assets``, and that
one measure surfaced by several paths is still one entity.
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from looker_sdk.sdk.api40.models import (
    LookmlModelExplore,
    LookmlModelExploreField,
    LookmlModelExploreFieldset,
    LookmlModelExploreJoins,
)

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.ometa_lineage import OMetaFQNLineageRequest
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.dashboard.looker.measures import looker_metric_name
from metadata.ingestion.source.dashboard.looker.metadata import (
    DATAMODEL_LINEAGE_SENTINEL,
    LookerSource,
)
from metadata.ingestion.source.dashboard.looker.models import LookMlField, LookMlView

SERVICE = "test_looker"
PROJECT = "my_project"


def _config(**source_config) -> dict:
    return {
        "source": {
            "type": "looker",
            "serviceName": SERVICE,
            "serviceConnection": {
                "config": {
                    "type": "Looker",
                    "clientId": "test",
                    "clientSecret": "test",
                    "hostPort": "https://my-looker.com",
                }
            },
            "sourceConfig": {"config": {"type": "DashboardMetadata", **source_config}},
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


def _data_model(name: str) -> DashboardDataModel:
    return DashboardDataModel(
        id=uuid.uuid4(),
        name=name,
        displayName=name,
        service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        dataModelType=DataModelType.LookMlView,
        columns=[],
    )


def _source_table() -> Table:
    return Table(
        id=uuid.uuid4(),
        name="my_table",
        fullyQualifiedName="trino.db.schema.my_table",
        columns=[
            Column(name="amount", dataType=DataType.NUMBER, fullyQualifiedName="trino.db.schema.my_table.amount"),
            Column(name="id", dataType=DataType.NUMBER, fullyQualifiedName="trino.db.schema.my_table.id"),
        ],
    )


def _measure(name: str, **kwargs) -> LookMlField:
    return LookMlField(name=name, **kwargs)


def _views() -> dict[str, LookMlView]:
    return {
        "my_view": LookMlView(
            name="my_view",
            sql_table_name="db.schema.my_table",
            dimensions=[_measure("id", type="number", sql="${TABLE}.id")],
            measures=[
                _measure("total_revenue", type="sum", sql="${TABLE}.amount", label="Total Revenue"),
                _measure("avg_revenue", type="number", sql="${total_revenue} / 2"),
            ],
        ),
        "joined_view": LookMlView(
            name="joined_view",
            sql_table_name="db.schema.joined_table",
            measures=[_measure("joined_count", type="count")],
        ),
        # Referenced by no explore, so it only reaches us down the standalone path.
        "orphan_view": LookMlView(
            name="orphan_view",
            measures=[_measure("orphan_total", type="sum", sql="${TABLE}.amount")],
        ),
    }


def _explore() -> LookmlModelExplore:
    """An explore exposing `my_view`'s measures the way the Looker API reports them.

    The field list is alphabetical, as the API returns it -- which is what puts the derived
    `avg_revenue` ahead of the `total_revenue` it is computed from.
    """
    return LookmlModelExplore(
        name="my_explore",
        model_name="my_model",
        project_name=PROJECT,
        view_name="my_view",
        joins=[LookmlModelExploreJoins(name="joined_view")],
        fields=LookmlModelExploreFieldset(
            dimensions=[],
            measures=[
                LookmlModelExploreField(
                    name="my_view.api_only_measure",
                    view="my_view",
                    project_name=PROJECT,
                    measure=True,
                    type="count",
                ),
                LookmlModelExploreField(
                    name="my_view.avg_revenue",
                    view="my_view",
                    project_name=PROJECT,
                    measure=True,
                    type="number",
                ),
                LookmlModelExploreField(
                    name="my_view.total_revenue",
                    view="my_view",
                    project_name=PROJECT,
                    measure=True,
                    type="sum",
                    label="Total Revenue",
                ),
            ],
        ),
    )


def _looker_source(**source_config) -> LookerSource:
    with patch(
        "metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection",
        return_value=False,
    ):
        config_dict = _config(**source_config)
        config = OpenMetadataWorkflowConfig.model_validate(config_dict)
        return LookerSource.create(config_dict["source"], config.workflowConfig.openMetadataServerConfig)


def _run_bulk_stage(source_config: dict, db_service_prefixes: list[str] | None = None):
    """Drive the bulk data-model stage the way the workflow does.

    The sink commits its buffer on a Barrier, so `_build_data_model` only returns an entity
    once one has gone past -- the same ordering the real run has.
    """
    looker = _looker_source(**source_config)
    looker.context.get().__dict__["dashboard_service"] = SERVICE

    views = _views()

    def find_view(view_name):
        """`_process_view` calls this by keyword, so `views.get` cannot stand in."""
        return views.get(view_name)

    parser = MagicMock()
    parser._views_cache = views
    parser.parsed_files = {}
    parser.find_view.side_effect = find_view

    looker._repo_credentials = True
    looker._project_parsers = {PROJECT: parser}
    looker._all_lookml_models = [MagicMock(name="my_model")]
    looker._all_lookml_models[0].name = "my_model"

    records = []
    flushed = False

    def build_data_model(data_model_name):
        return _data_model(data_model_name) if flushed else None

    with (
        patch.object(LookerSource, "register_record_datamodel", return_value=None),
        patch.object(LookerSource, "_get_explore_sql", return_value=None),
        patch.object(LookerSource, "_build_data_model", side_effect=build_data_model),
        patch.object(LookerSource, "get_db_service_prefixes", return_value=db_service_prefixes or []),
        patch.object(LookerSource, "parse_db_service_prefix", side_effect=lambda prefix: (prefix, None, None, None)),
        patch.object(LookerSource, "_get_db_dialect", return_value=None),
        patch.object(LookerSource, "_clean_table_name", side_effect=lambda name, dialect=None: name),
        patch.object(LookerSource, "_resolve_source_table", return_value=_source_table()),
    ):
        for node_entity in (_explore(), DATAMODEL_LINEAGE_SENTINEL):
            for either in looker.yield_bulk_datamodel(node_entity):
                records.append(either)
                if either.right is not None and isinstance(either.right, Barrier):
                    flushed = True

    return records


def _metrics(records) -> list[CreateMetricRequest]:
    return [r.right for r in records if isinstance(r.right, CreateMetricRequest)]


def _metric_lineage(records) -> list[OMetaFQNLineageRequest]:
    return [
        r.right for r in records if isinstance(r.right, OMetaFQNLineageRequest) and r.right.to_entity_type == "metric"
    ]


@pytest.fixture(name="records")
def records_fixture():
    return _run_bulk_stage({"includeMetrics": True})


@pytest.fixture(name="by_display_name")
def by_display_name_fixture(records):
    return {metric.displayName: metric for metric in _metrics(records)}


# --------------------------------------------------------------------------------------
# The gate
# --------------------------------------------------------------------------------------


def test_metrics_are_off_by_default():
    """`includeMetrics` defaults to false: the Metric namespace is global, so an existing
    pipeline must not start filling it after an upgrade."""
    assert _metrics(_run_bulk_stage({})) == []


def test_no_metric_lineage_when_metrics_are_off():
    assert _metric_lineage(_run_bulk_stage({}, db_service_prefixes=["trino"])) == []


# --------------------------------------------------------------------------------------
# Emission
# --------------------------------------------------------------------------------------


def test_measures_from_views_explores_and_standalone_views_are_all_emitted(by_display_name):
    assert set(by_display_name) == {
        "Total Revenue",  # declared in my_view, also surfaced by the explore
        "avg_revenue",  # declared in my_view only
        "api_only_measure",  # only the explore's field list knows about it
        "joined_count",  # a view joined into the explore
        "orphan_total",  # a view no explore references
    }


def test_a_measure_seen_through_both_sources_is_one_metric(by_display_name):
    """`total_revenue` arrives from the explore API *and* from the LookML file."""
    assert len([m for m in by_display_name.values() if m.measures[0].name == "total_revenue"]) == 1


def test_the_lookml_definition_wins_over_the_api(by_display_name):
    """The API field carries no `sql`; the LookML one does, and that is what must survive."""
    assert by_display_name["Total Revenue"].metricExpression.code == "${TABLE}.amount"


def test_metrics_are_emitted_after_the_barrier(records):
    """`assets` needs ids, which only exist once the data models have been written."""
    barrier_index = next(index for index, r in enumerate(records) if isinstance(r.right, Barrier))
    metric_indexes = [index for index, r in enumerate(records) if isinstance(r.right, CreateMetricRequest)]

    assert metric_indexes, "the stage emitted no metrics"
    assert min(metric_indexes) > barrier_index


def test_assets_point_at_resolved_data_models(by_display_name):
    assets = by_display_name["Total Revenue"].assets.root

    assert [asset.type for asset in assets] == ["dashboardDataModel", "dashboardDataModel"]
    assert all(asset.id is not None for asset in assets)


def test_the_defining_view_is_the_first_asset(by_display_name):
    assets = by_display_name["Total Revenue"].assets.root

    assert model_str(assets[0].name) == "my_model_my_view_view"
    assert model_str(assets[1].name) == "my_model_my_explore"


def test_a_standalone_views_measure_has_its_view_as_an_asset(by_display_name):
    assets = by_display_name["orphan_total"].assets.root

    assert [model_str(asset.name) for asset in assets] == ["my_model_orphan_view_view"]


def test_metric_names_are_stable_across_runs():
    """Repeated ingestion PUTs the same entities; nothing is duplicated or churned."""
    first = {model_str(metric.name) for metric in _metrics(_run_bulk_stage({"includeMetrics": True}))}
    second = {model_str(metric.name) for metric in _metrics(_run_bulk_stage({"includeMetrics": True}))}

    assert first == second
    assert len(first) == 5


def test_project_order_follows_the_models_rather_than_set_iteration():
    """`yield_standalone_datamodels` attributes every standalone view to the first project,
    and that project is part of the hashed Metric name. Collecting the projects into a `set`
    reorders them between processes -- string hashing is randomised -- which would mint a new
    Metric for every standalone measure on each run. Enough projects are used here that a
    reintroduced `set` cannot pass by coincidence.
    """
    projects = ("zeta", "alpha", "zeta", "mu", "ecommerce", "sales", "ops", "finance", "core")

    looker = _looker_source()
    looker._repo_credentials = True
    looker._reader_class = MagicMock()
    looker._main_lookml_repos = [MagicMock(path="/tmp/repo")]

    with patch("metadata.ingestion.source.dashboard.looker.metadata.BulkLkmlParser", return_value=MagicMock()):
        looker.parser = [MagicMock(project_name=name) for name in projects]

    assert list(looker._project_parsers) == list(dict.fromkeys(projects))


# --------------------------------------------------------------------------------------
# Lineage
# --------------------------------------------------------------------------------------


def test_metric_to_metric_lineage_follows_a_measure_reference(records):
    """`avg_revenue` is computed from `${total_revenue}`."""
    parent = looker_metric_name(SERVICE, PROJECT, "my_view", "total_revenue")
    child = looker_metric_name(SERVICE, PROJECT, "my_view", "avg_revenue")

    edges = [
        edge for edge in _metric_lineage(records) if edge.from_entity_type == "metric" and edge.to_entity_fqn == child
    ]

    assert [edge.from_entity_fqn for edge in edges] == [parent]


def test_related_metrics_records_the_same_dependency(by_display_name):
    parent = looker_metric_name(SERVICE, PROJECT, "my_view", "total_revenue")

    assert [model_str(related) for related in by_display_name["avg_revenue"].relatedMetrics] == [parent]


def test_a_derived_measure_is_emitted_after_the_parent_it_references(records):
    """The server resolves `relatedMetrics` at create time, so the parent has to exist first.

    The explore lists its fields alphabetically, so collection order alone puts `avg_revenue`
    ahead of `${total_revenue}` and the create would be rejected.
    """
    names = [model_str(metric.name) for metric in _metrics(records)]

    parent = names.index(looker_metric_name(SERVICE, PROJECT, "my_view", "total_revenue"))
    child = names.index(looker_metric_name(SERVICE, PROJECT, "my_view", "avg_revenue"))

    assert parent < child


def test_table_to_metric_lineage_carries_column_lineage():
    records = _run_bulk_stage({"includeMetrics": True}, db_service_prefixes=["trino"])
    metric_name = looker_metric_name(SERVICE, PROJECT, "my_view", "total_revenue")

    (edge,) = [
        edge
        for edge in _metric_lineage(records)
        if edge.from_entity_type == "table" and edge.to_entity_fqn == metric_name
    ]

    assert edge.from_entity_fqn == "trino.db.schema.my_table"
    assert [
        ([model_str(column) for column in c.fromColumns], model_str(c.toColumn))
        for c in edge.lineage_details.columnsLineage
    ] == [(["trino.db.schema.my_table.amount"], f"{metric_name}.measure.total_revenue")]


def test_a_derived_measure_resolves_its_columns_transitively():
    """`avg_revenue` never names a column; it reaches `amount` through `${total_revenue}`."""
    records = _run_bulk_stage({"includeMetrics": True}, db_service_prefixes=["trino"])
    metric_name = looker_metric_name(SERVICE, PROJECT, "my_view", "avg_revenue")

    (edge,) = [
        edge
        for edge in _metric_lineage(records)
        if edge.from_entity_type == "table" and edge.to_entity_fqn == metric_name
    ]

    assert [[model_str(column) for column in c.fromColumns] for c in edge.lineage_details.columnsLineage] == [
        ["trino.db.schema.my_table.amount"]
    ]


def test_no_table_lineage_without_a_configured_db_service(records):
    assert [edge for edge in _metric_lineage(records) if edge.from_entity_type == "table"] == []
