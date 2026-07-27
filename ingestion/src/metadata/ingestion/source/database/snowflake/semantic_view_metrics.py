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
Builders that turn Snowflake semantic-view catalog rows into OpenMetadata
``Metric`` entities.

A Snowflake semantic view's METRICS are aggregations (``SUM(...)``, ``COUNT(...)``)
over the view's FACTS/DIMENSIONS. Each becomes a first-class OpenMetadata ``Metric``
carrying its expression, inferred type, the view's dimensions/facts, and an
``assets`` link back to the semantic-view table. Metric names are fully qualified
because the ``Metric`` namespace is global (FQN == name).
"""

from typing import List, Optional  # noqa: UP035

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import (
    Language,
    MetricDimension,
    MetricExpression,
    MetricMeasure,
    MetricType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.utils import fqn

# Column layout of INFORMATION_SCHEMA.SEMANTIC_{DIMENSIONS,FACTS,METRICS}:
# (TABLE_NAME, NAME, DATA_TYPE, EXPRESSION, COMMENT, SYNONYMS)
SEMANTIC_NAME_IDX = 1
SEMANTIC_EXPRESSION_IDX = 3
SEMANTIC_COMMENT_IDX = 4

_METRIC_TYPE_BY_PREFIX = {
    "SUM": MetricType.SUM,
    "COUNT": MetricType.COUNT,
    "AVG": MetricType.AVERAGE,
    "MIN": MetricType.MIN,
    "MAX": MetricType.MAX,
}


def build_metric_name(service: str, database: str, schema: str, view: str, metric: str) -> str:
    """Fully qualified, globally-unique metric name (Metric FQN == name)."""
    return fqn._build(service, database, schema, view, metric)


def infer_metric_type(expression: Optional[str]) -> MetricType:  # noqa: UP045
    """Infer the MetricType from the aggregation head of the expression."""
    result = MetricType.OTHER
    if expression:
        head = expression.strip().split("(")[0].strip().upper()
        result = _METRIC_TYPE_BY_PREFIX.get(head, MetricType.OTHER)
    return result


def _dimension(row) -> MetricDimension:
    return MetricDimension(  # pyright: ignore[reportCallIssue]
        name=row[SEMANTIC_NAME_IDX],
        description=row[SEMANTIC_COMMENT_IDX] or None,
        expression=row[SEMANTIC_EXPRESSION_IDX] or None,
    )


def _measure(row) -> MetricMeasure:
    return MetricMeasure(  # pyright: ignore[reportCallIssue]
        name=row[SEMANTIC_NAME_IDX],
        description=row[SEMANTIC_COMMENT_IDX] or None,
        expression=row[SEMANTIC_EXPRESSION_IDX] or None,
    )


def build_metric_request(
    service: str,
    database: str,
    schema: str,
    view: str,
    metric_row,
    dimension_rows: List[tuple],  # noqa: UP006
    fact_rows: List[tuple],  # noqa: UP006
    view_ref: Optional[EntityReference],  # noqa: UP045
) -> CreateMetricRequest:
    """Assemble a CreateMetricRequest for a single Snowflake metric row."""
    metric = metric_row[SEMANTIC_NAME_IDX]
    expression = metric_row[SEMANTIC_EXPRESSION_IDX]
    dimensions = [_dimension(row) for row in dimension_rows] or None
    measures = [_measure(row) for row in fact_rows] or None
    metric_expression = MetricExpression(language=Language.SQL, code=expression) if expression else None
    assets = EntityReferenceList(root=[view_ref]) if view_ref is not None else None
    return CreateMetricRequest(  # pyright: ignore[reportCallIssue]
        name=build_metric_name(service, database, schema, view, metric),
        displayName=metric,
        description=metric_row[SEMANTIC_COMMENT_IDX] or None,
        metricType=infer_metric_type(expression),
        metricExpression=metric_expression,
        dimensions=dimensions,
        measures=measures,
        assets=assets,
    )
