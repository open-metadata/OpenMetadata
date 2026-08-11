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
"""dbt semantic-layer adapter: manifest metric node → normalized MetricDefinition.

Pure translation. ``semantic_models`` and ``all_metrics`` arrive as the manifest's
own dicts keyed by ``unique_id``; the semantic models backing a metric are selected
through its ``depends_on``. Tags need an API lookup to become TagLabels, so the
caller resolves them and passes them in.
"""

from __future__ import annotations

import contextlib
from collections.abc import Iterable  # noqa: TC003
from typing import Any

from metadata.domain.metrics.naming import build_qualified_metric_name
from metadata.domain.metrics.records import (
    MetricDefinition,
    MetricKey,
    MetricOrigin,
    MetricSourceType,
)
from metadata.generated.schema.entity.data.metric import (
    Language,
    MetricDimension,
    MetricExpression,
    MetricFilter,
    MetricGranularity,
    MetricMeasure,
    MetricType,
)
from metadata.generated.schema.type.entityReferenceInput import EntityReferenceInput
from metadata.generated.schema.type.tagLabel import TagLabel  # noqa: TC001
from metadata.ingestion.source.database.dbt.dbt_utils import (
    find_dependent_metric_names,
    find_semantic_models_for_metric,
    find_semantic_models_transitive,
    map_dbt_metric_type,
)


def normalize_dbt_metric(
    metric_node: Any,
    semantic_models: dict[str, Any],
    *,
    service_name: str,
    all_metrics: dict[str, Any] | None = None,
    tags: tuple[TagLabel, ...] = (),
) -> MetricDefinition:
    """Turn a parsed dbt metric node into a MetricDefinition.

    ``semantic_models`` / ``all_metrics`` are the manifest dicts keyed by
    ``unique_id``. ``tags`` must already be resolved to TagLabels by the caller.
    """
    all_metrics = all_metrics or {}
    dbt_type = _enum_value(getattr(metric_node, "type", None))
    expression = _expression(dbt_type, getattr(metric_node, "type_params", None))
    models = _models_for(metric_node, semantic_models, all_metrics)

    origin = MetricOrigin(
        source_type=MetricSourceType.DBT,
        service_name=service_name,
        external_id=str(getattr(metric_node, "unique_id", metric_node.name)),
    )
    package = str(getattr(metric_node, "package_name", "") or "")

    return MetricDefinition(
        key=MetricKey.from_origin(origin),
        origin=origin,
        name=build_qualified_metric_name(service_name, package, metric_node.name),
        display_name=getattr(metric_node, "label", None) or metric_node.name,
        description=getattr(metric_node, "description", None) or None,
        expression=expression,
        metric_type=map_dbt_metric_type(dbt_type) or MetricType.OTHER,
        granularity=_granularity(metric_node),
        dimensions=tuple(_dimensions(models)),
        measures=tuple(_measures(models)),
        filters=tuple(_filters(metric_node)),
        tags=tuple(tags),
        depends_on=_dependency_keys(find_dependent_metric_names(metric_node), all_metrics, service_name),
        related_assets=tuple(_asset_refs(models, service_name)),
    )


def _models_for(metric_node: Any, semantic_models: dict[str, Any], all_metrics: dict[str, Any]) -> list[Any]:
    """Semantic models backing this metric, following parent metrics when known."""
    if all_metrics:
        return find_semantic_models_transitive(metric_node, semantic_models, all_metrics)
    return find_semantic_models_for_metric(metric_node, semantic_models)


def _enum_value(value: Any) -> str:
    if value is None:
        return ""
    return str(getattr(value, "value", value)).lower()


def _expression(dbt_type: str, type_params: Any) -> MetricExpression | None:
    builder = _EXPRESSION_BUILDERS.get(dbt_type)
    return builder(type_params) if builder and type_params else None


def _simple_expression(type_params: Any) -> MetricExpression | None:
    name = _ref_name(getattr(type_params, "measure", None))
    return _sql(name) if name else None


def _derived_expression(type_params: Any) -> MetricExpression | None:
    expr = getattr(type_params, "expr", None)
    return _sql(expr) if expr else None


def _ratio_expression(type_params: Any) -> MetricExpression | None:
    numerator = _ref_name(getattr(type_params, "numerator", None))
    denominator = _ref_name(getattr(type_params, "denominator", None))
    return _sql(f"{numerator} / {denominator}") if numerator and denominator else None


def _cumulative_expression(type_params: Any) -> MetricExpression | None:
    name = _ref_name(getattr(type_params, "measure", None))
    return _sql(f"cumulative({name}{_cumulative_window(type_params)})") if name else None


def _conversion_expression(type_params: Any) -> MetricExpression | None:
    conversion = getattr(type_params, "conversion_type_params", None)
    if not conversion:
        return None
    base = _ref_name(getattr(conversion, "base_measure", None)) or ""
    target = _ref_name(getattr(conversion, "conversion_measure", None)) or ""
    entity = getattr(conversion, "entity", "") or ""
    return _sql(f"conversion({base} -> {target}, entity={entity})")


_EXPRESSION_BUILDERS = {
    "simple": _simple_expression,
    "derived": _derived_expression,
    "ratio": _ratio_expression,
    "cumulative": _cumulative_expression,
    "conversion": _conversion_expression,
}


def _cumulative_window(type_params: Any) -> str:
    params = getattr(type_params, "cumulative_type_params", None)
    window = getattr(params, "window", None) if params else None
    if not window:
        return ""
    count = getattr(window, "count", "")
    granularity = getattr(window, "granularity", None)
    value = getattr(granularity, "value", str(granularity)) if granularity else ""
    return f" over {count} {value}" if count else ""


def _ref_name(ref: Any) -> str | None:
    return getattr(ref, "name", None) if ref is not None else None


def _sql(code: str) -> MetricExpression:
    return MetricExpression(language=Language.SQL, code=code)


def _dependency_keys(related_names: list[str], all_metrics: dict[str, Any], service_name: str) -> tuple[MetricKey, ...]:
    """Map related metric names onto MetricKeys via each node's unique_id.

    ``all_metrics`` is keyed by unique_id, so the names are resolved through a
    name index rather than used as keys.
    """
    unique_id_by_name: dict[str, str] = {}
    for node in all_metrics.values():
        name = getattr(node, "name", None)
        if name:
            unique_id_by_name[name] = str(getattr(node, "unique_id", name))
    return tuple(
        MetricKey(
            source_type=MetricSourceType.DBT,
            service_name=service_name,
            external_id=unique_id_by_name[name],
        )
        for name in related_names
        if name in unique_id_by_name
    )


def _dimensions(models: list[Any]) -> Iterable[MetricDimension]:
    seen: set[str] = set()
    for model in models:
        for dimension in getattr(model, "dimensions", None) or []:
            if dimension.name in seen:
                continue
            seen.add(dimension.name)
            raw_type = getattr(dimension, "type", None)
            yield MetricDimension(  # pyright: ignore[reportCallIssue]
                name=dimension.name,
                type=(getattr(raw_type, "value", str(raw_type)).upper() if raw_type else None),
                description=getattr(dimension, "description", None),
                expression=getattr(dimension, "expr", None),
            )


def _measures(models: list[Any]) -> Iterable[MetricMeasure]:
    seen: set[str] = set()
    for model in models:
        for measure in getattr(model, "measures", None) or []:
            if measure.name in seen:
                continue
            seen.add(measure.name)
            agg = getattr(measure, "agg", None)
            yield MetricMeasure(  # pyright: ignore[reportCallIssue]
                name=measure.name,
                aggregation=(str(getattr(agg, "value", agg)) if agg else None),
                description=getattr(measure, "description", None),
                expression=getattr(measure, "expr", None),
            )


def _filters(metric_node: Any) -> Iterable[MetricFilter]:
    filter_obj = getattr(metric_node, "filter", None)
    if not filter_obj:
        return
    for where_filter in getattr(filter_obj, "where_filters", None) or []:
        template = getattr(where_filter, "where_sql_template", None)
        if template:
            yield MetricFilter(where=template)


def _granularity(metric_node: Any) -> MetricGranularity | None:
    raw = getattr(metric_node, "time_granularity", None)
    if not raw:
        return None
    value = str(getattr(raw, "value", raw)).upper()
    with contextlib.suppress(ValueError):
        return MetricGranularity(value)
    return None


def _asset_refs(models: list[Any], service_name: str) -> Iterable[EntityReferenceInput]:
    """The physical tables backing each semantic model, as fqn-only references."""
    seen: set[str] = set()
    for model in models:
        relation = getattr(model, "node_relation", None)
        if relation is None:
            continue
        database = getattr(relation, "database", None)
        schema = getattr(relation, "schema_name", None)
        table = getattr(relation, "alias", None)
        if not (database and schema and table):
            continue
        fully_qualified_name = f"{service_name}.{database}.{schema}.{table}"
        if fully_qualified_name in seen:
            continue
        seen.add(fully_qualified_name)
        yield EntityReferenceInput(type="table", fullyQualifiedName=fully_qualified_name)
