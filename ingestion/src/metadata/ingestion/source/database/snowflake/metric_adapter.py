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
"""Snowflake semantic-view adapter: catalog rows → normalized MetricDefinition
with fqn-only EntityReferenceInput assets (server resolves fqn → id on write)."""

from __future__ import annotations

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
    MetricMeasure,
    MetricType,
    Type,
)
from metadata.generated.schema.type.entityReferenceInput import EntityReferenceInput

_SEMANTIC_NAME_IDX = 1
_SEMANTIC_DATA_TYPE_IDX = 2
_SEMANTIC_EXPRESSION_IDX = 3
_SEMANTIC_COMMENT_IDX = 4
_SEMANTIC_SYNONYMS_IDX = 5

_METRIC_TYPE_BY_PREFIX = {
    "SUM": MetricType.SUM,
    "COUNT": MetricType.COUNT,
    "AVG": MetricType.AVERAGE,
    "MIN": MetricType.MIN,
    "MAX": MetricType.MAX,
}

_TIME_TYPE_MARKERS = ("DATE", "TIME", "TIMESTAMP")


def build_metric_external_id(service: str, database: str, schema: str, view: str, metric: str) -> str:
    """Internal MetricKey identity — dots OK, only compared for dedup."""
    return f"{service}.{database}.{schema}.{view}.{metric}"


def build_metric_entity_name(service: str, database: str, schema: str, view: str, metric: str) -> str:
    """Server-visible metric name for a Snowflake semantic-view metric."""
    return build_qualified_metric_name(service, database, schema, view, metric)


def infer_metric_type(expression: str | None) -> MetricType:
    if not expression:
        return MetricType.OTHER
    head = expression.strip().split("(", 1)[0].strip().upper()
    return _METRIC_TYPE_BY_PREFIX.get(head, MetricType.OTHER)


def _aggregation(expression: str | None) -> str | None:
    if not expression or infer_metric_type(expression) is MetricType.OTHER:
        return None
    return expression.strip().split("(", 1)[0].strip().upper()


def _dimension_type(data_type: str | None) -> Type | None:
    if not data_type:
        return None
    upper = data_type.upper()
    return Type.TIME if any(m in upper for m in _TIME_TYPE_MARKERS) else Type.CATEGORICAL


def _description(row: tuple) -> str | None:
    parts: list[str] = []
    comment = row[_SEMANTIC_COMMENT_IDX]
    synonyms = row[_SEMANTIC_SYNONYMS_IDX] if len(row) > _SEMANTIC_SYNONYMS_IDX else None
    if comment:
        parts.append(str(comment))
    if synonyms:
        parts.append(f"Synonyms: {synonyms}.")
    return " ".join(parts) or None


def _dimension(row: tuple) -> MetricDimension:
    return MetricDimension(  # pyright: ignore[reportCallIssue]
        name=row[_SEMANTIC_NAME_IDX],
        type=_dimension_type(row[_SEMANTIC_DATA_TYPE_IDX]),
        description=_description(row),
        expression=row[_SEMANTIC_EXPRESSION_IDX] or None,
    )


def _measure(row: tuple) -> MetricMeasure:
    expression = row[_SEMANTIC_EXPRESSION_IDX]
    return MetricMeasure(  # pyright: ignore[reportCallIssue]
        name=row[_SEMANTIC_NAME_IDX],
        aggregation=_aggregation(expression),
        description=_description(row),
        expression=expression or None,
    )


def _table_ref(fully_qualified_name: str) -> EntityReferenceInput:
    return EntityReferenceInput(type="table", fullyQualifiedName=fully_qualified_name)


def normalize_snowflake_metric(
    *,
    service_name: str,
    database: str,
    schema: str,
    view: str,
    metric_row: tuple,
    dimension_rows: list[tuple],
    fact_rows: list[tuple],
) -> MetricDefinition:
    """Assemble a MetricDefinition from one Snowflake semantic-view metric row.

    ``assets`` holds the semantic view alone. Physical base tables sit one hop
    further upstream (base table → view → metric) and are represented as
    lineage edges rather than flattened into a direct metric-to-table link.
    """
    metric_name = metric_row[_SEMANTIC_NAME_IDX]
    expression = metric_row[_SEMANTIC_EXPRESSION_IDX]
    comment = metric_row[_SEMANTIC_COMMENT_IDX]

    external_id = build_metric_external_id(service_name, database, schema, view, metric_name)
    origin = MetricOrigin(
        source_type=MetricSourceType.SNOWFLAKE,
        service_name=service_name,
        external_id=external_id,
    )
    key = MetricKey.from_origin(origin)

    metric_expression = MetricExpression(language=Language.SQL, code=expression) if expression else None
    view_fqn = f"{service_name}.{database}.{schema}.{view}"

    return MetricDefinition(
        key=key,
        origin=origin,
        name=build_metric_entity_name(service_name, database, schema, view, metric_name),
        display_name=metric_name,
        description=comment or None,
        expression=metric_expression,
        metric_type=infer_metric_type(expression),
        dimensions=tuple(_dimension(row) for row in dimension_rows),
        measures=tuple(_measure(row) for row in fact_rows),
        related_assets=(_table_ref(view_fqn),),
    )
