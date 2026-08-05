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

import hashlib
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

# Metric names are qualified with the full service/database/schema/view path but must
# stay a *single* FQN segment, so the path is joined with "-" rather than ".".
METRIC_NAME_SEPARATOR = "-"
# `entityName` in openmetadata-spec/.../type/basic.json caps names at 256 characters.
MAX_METRIC_NAME_LENGTH = 256
_NAME_DIGEST_LENGTH = 12

_METRIC_TYPE_BY_PREFIX = {
    "SUM": MetricType.SUM,
    "COUNT": MetricType.COUNT,
    "AVG": MetricType.AVERAGE,
    "MIN": MetricType.MIN,
    "MAX": MetricType.MAX,
}


def _sanitize_name_part(part: str) -> str:
    """Reduce one identifier to a single FQN-safe segment.

    Unquotes the Snowflake identifier, then removes the characters that carry
    structural meaning in an OpenMetadata name: ``.`` (FQN separator), ``"``
    (FQN quoting) and ``::`` (forbidden by the ``entityName`` pattern).
    """
    cleaned = fqn.unquote_name(part or "").replace('"', "")
    for reserved in (".", ":"):
        cleaned = cleaned.replace(reserved, "_")
    return cleaned


def build_metric_name(service: str, database: str, schema: str, view: str, metric: str) -> str:
    """Globally-unique metric name as a single, dot-free FQN segment.

    A Metric's FQN *is* its name (``MetricRepository.setFullyQualifiedName``) and the
    server derives dimension/measure FQNs by appending to it, so a dot-separated name
    yields six-segment FQNs that positional FQN parsers read as
    ``service.database.schema.table.column``. We still qualify with the full path —
    the Metric namespace is flat, so a bare metric name would collide across
    schemas, databases and services — but join with ``METRIC_NAME_SEPARATOR`` so the
    whole thing stays one segment.

    Names longer than the ``entityName`` limit are truncated and suffixed with a
    digest of the full path, which keeps them unique and still deterministic for the
    lineage workflow (it re-derives the name through this same function).
    """
    parts = [_sanitize_name_part(part) for part in (service, database, schema, view, metric)]
    name = METRIC_NAME_SEPARATOR.join(parts)
    if len(name) > MAX_METRIC_NAME_LENGTH:
        digest = hashlib.sha256(name.encode("utf-8")).hexdigest()[:_NAME_DIGEST_LENGTH]
        keep = MAX_METRIC_NAME_LENGTH - _NAME_DIGEST_LENGTH - len(METRIC_NAME_SEPARATOR)
        name = f"{name[:keep]}{METRIC_NAME_SEPARATOR}{digest}"
    return name


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
