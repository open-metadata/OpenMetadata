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
"""dbt metric adapter — fixtures mirror the manifest v12 shapes the connector
receives: ``semantic_models`` / ``all_metrics`` are dicts keyed by unique_id and
the backing models are reached through the metric's ``depends_on``."""

from __future__ import annotations

from types import SimpleNamespace as Ns

from metadata.domain.metrics.records import MetricSourceType
from metadata.generated.schema.entity.data.metric import MetricType
from metadata.ingestion.source.database.dbt.metric_adapter import normalize_dbt_metric

SERVICE = "dbt_svc"


def _dimension(name: str, dim_type: str = "categorical", expr: str | None = None):
    return Ns(name=name, type=Ns(value=dim_type), description=f"{name} desc", expr=expr)


def _measure(name: str, agg: str = "sum", expr: str | None = None):
    return Ns(name=name, agg=Ns(value=agg), description=f"{name} desc", expr=expr)


def _semantic_model(unique_id: str, name: str, dimensions=(), measures=(), relation=True):
    return Ns(
        name=name,
        unique_id=unique_id,
        dimensions=list(dimensions),
        measures=list(measures),
        node_relation=(
            Ns(database="my_db", schema_name="my_schema", alias="orders", relation_name=None) if relation else None
        ),
    )


def _metric(
    name: str,
    metric_type: str = "simple",
    *,
    unique_id: str | None = None,
    package: str = "analytics",
    type_params=None,
    depends_on=(),
    label: str | None = None,
):
    return Ns(
        name=name,
        unique_id=unique_id or f"metric.analytics.{name}",
        package_name=package,
        type=Ns(value=metric_type),
        type_params=type_params,
        depends_on=Ns(nodes=list(depends_on), macros=[]),
        label=label,
        description=f"{name} description",
        filter=None,
        time_granularity=None,
        tags=None,
    )


def test_dict_shaped_semantic_models_yield_dimensions_and_measures():
    """The manifest hands over a dict keyed by unique_id, not a list — iterating
    it directly would walk string keys and silently produce nothing."""
    sm_id = "semantic_model.analytics.orders"
    semantic_models = {
        sm_id: _semantic_model(sm_id, "orders", dimensions=[_dimension("region")], measures=[_measure("amount")])
    }
    node = _metric("revenue", type_params=Ns(measure=Ns(name="amount")), depends_on=[sm_id])

    definition = normalize_dbt_metric(node, semantic_models, service_name=SERVICE)

    assert [d.name for d in definition.dimensions] == ["region"]
    assert [m.name for m in definition.measures] == ["amount"]


def test_metric_name_is_qualified_with_service_and_package():
    node = _metric("revenue", type_params=Ns(measure=Ns(name="amount")))
    definition = normalize_dbt_metric(node, {}, service_name=SERVICE)

    assert definition.name == "dbt_svc-analytics-revenue"
    assert "." not in definition.name
    assert definition.display_name == "revenue"
    assert definition.origin.source_type is MetricSourceType.DBT
    assert definition.origin.external_id == "metric.analytics.revenue"


def test_dimension_type_and_measure_aggregation_are_mapped():
    sm_id = "semantic_model.analytics.orders"
    semantic_models = {
        sm_id: _semantic_model(
            sm_id,
            "orders",
            dimensions=[_dimension("ordered_at", "time"), _dimension("region", "categorical")],
            measures=[_measure("amount", "sum")],
        )
    }
    node = _metric("revenue", type_params=Ns(measure=Ns(name="amount")), depends_on=[sm_id])

    definition = normalize_dbt_metric(node, semantic_models, service_name=SERVICE)

    by_name = {d.name: d for d in definition.dimensions}
    assert by_name["ordered_at"].type.value.upper() == "TIME"
    assert by_name["region"].type.value.upper() == "CATEGORICAL"
    assert definition.measures[0].aggregation == "sum"


def test_derived_metric_records_dependencies_as_metric_keys():
    parent = _metric("revenue", type_params=Ns(measure=Ns(name="amount")))
    child = _metric(
        "margin",
        "derived",
        type_params=Ns(expr="revenue - cost", metrics=[Ns(name="revenue")]),
        depends_on=["metric.analytics.revenue"],
    )
    all_metrics = {parent.unique_id: parent, child.unique_id: child}

    definition = normalize_dbt_metric(child, {}, service_name=SERVICE, all_metrics=all_metrics)

    assert definition.metric_type is MetricType.DERIVED
    assert definition.expression.code == "revenue - cost"
    assert [k.external_id for k in definition.depends_on] == ["metric.analytics.revenue"]


def test_unknown_related_metric_is_dropped_from_dependencies():
    child = _metric(
        "margin",
        "derived",
        type_params=Ns(expr="revenue - cost", metrics=[Ns(name="ghost")]),
        depends_on=["metric.analytics.ghost"],
    )
    definition = normalize_dbt_metric(child, {}, service_name=SERVICE, all_metrics={child.unique_id: child})
    assert definition.depends_on == ()


def test_ratio_metric_builds_expression_and_two_dependencies():
    numerator = _metric("wins", unique_id="metric.analytics.wins")
    denominator = _metric("deals", unique_id="metric.analytics.deals")
    ratio = _metric(
        "win_rate",
        "ratio",
        type_params=Ns(numerator=Ns(name="wins"), denominator=Ns(name="deals")),
        depends_on=["metric.analytics.wins", "metric.analytics.deals"],
    )
    all_metrics = {m.unique_id: m for m in (numerator, denominator, ratio)}

    definition = normalize_dbt_metric(ratio, {}, service_name=SERVICE, all_metrics=all_metrics)

    assert definition.metric_type is MetricType.RATIO
    assert definition.expression.code == "wins / deals"
    assert {k.external_id for k in definition.depends_on} == {
        "metric.analytics.wins",
        "metric.analytics.deals",
    }


def test_conversion_metric_records_dependencies_from_the_dbt_graph():
    """Conversion metrics name their parents only in ``depends_on``, never in
    ``type_params`` — reading dependencies from the graph is what keeps them
    ordered behind their parents."""
    parent = _metric("visits", unique_id="metric.analytics.visits")
    conversion = _metric(
        "signup_rate",
        "conversion",
        type_params=Ns(
            conversion_type_params=Ns(
                base_measure=Ns(name="visits"),
                conversion_measure=Ns(name="signups"),
                entity="user",
            )
        ),
        depends_on=["metric.analytics.visits"],
    )
    all_metrics = {m.unique_id: m for m in (parent, conversion)}

    definition = normalize_dbt_metric(conversion, {}, service_name=SERVICE, all_metrics=all_metrics)

    assert definition.metric_type is MetricType.CONVERSION
    assert [k.external_id for k in definition.depends_on] == ["metric.analytics.visits"]


def test_assets_reference_the_semantic_model_backing_tables():
    sm_id = "semantic_model.analytics.orders"
    semantic_models = {sm_id: _semantic_model(sm_id, "orders")}
    node = _metric("revenue", type_params=Ns(measure=Ns(name="amount")), depends_on=[sm_id])

    definition = normalize_dbt_metric(node, semantic_models, service_name=SERVICE)

    assert len(definition.related_assets) == 1
    asset = definition.related_assets[0]
    assert asset.type == "table"
    assert asset.fullyQualifiedName == "dbt_svc.my_db.my_schema.orders"
    assert asset.id is None


def test_semantic_model_without_node_relation_contributes_no_asset():
    sm_id = "semantic_model.analytics.orders"
    semantic_models = {sm_id: _semantic_model(sm_id, "orders", relation=False)}
    node = _metric("revenue", type_params=Ns(measure=Ns(name="amount")), depends_on=[sm_id])

    definition = normalize_dbt_metric(node, semantic_models, service_name=SERVICE)
    assert definition.related_assets == ()


def test_tags_are_passed_through_from_the_caller():
    """Tag resolution needs an API lookup, so the connector resolves them and the
    adapter stays pure."""
    from metadata.generated.schema.type.tagLabel import (
        LabelType,
        State,
        TagLabel,
        TagSource,
    )

    label = TagLabel(
        tagFQN="dbtTags.gold",
        labelType=LabelType.Automated,
        state=State.Suggested,
        source=TagSource.Classification,
    )
    node = _metric("revenue", type_params=Ns(measure=Ns(name="amount")))

    definition = normalize_dbt_metric(node, {}, service_name=SERVICE, tags=(label,))

    assert len(definition.tags) == 1
    assert definition.tags[0].tagFQN.root == "dbtTags.gold"


def test_unknown_metric_type_falls_back_to_other():
    node = _metric("weird", "some_future_type", type_params=Ns(measure=Ns(name="amount")))
    definition = normalize_dbt_metric(node, {}, service_name=SERVICE)
    assert definition.metric_type is MetricType.OTHER
