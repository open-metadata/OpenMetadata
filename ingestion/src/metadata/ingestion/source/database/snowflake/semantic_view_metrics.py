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
from typing import List, Optional, Tuple  # noqa: UP035

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import (
    Language,
    MetricDimension,
    MetricExpression,
    MetricMeasure,
    MetricType,
    Type,
)
from metadata.generated.schema.type.basic import EntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.utils import fqn

# Column layout of INFORMATION_SCHEMA.SEMANTIC_{DIMENSIONS,FACTS,METRICS}:
# (TABLE_NAME, NAME, DATA_TYPE, EXPRESSION, COMMENT, SYNONYMS)
# TABLE_NAME (index 0) is unused: the owning logical table is already named by the
# expression (e.g. `customers.c_region`), so repeating it in the description is noise.
SEMANTIC_NAME_IDX = 1
SEMANTIC_DATA_TYPE_IDX = 2
SEMANTIC_EXPRESSION_IDX = 3
SEMANTIC_COMMENT_IDX = 4
SEMANTIC_SYNONYMS_IDX = 5

# Snowflake data types that make a dimension a TIME dimension rather than CATEGORICAL.
_TIME_TYPE_MARKERS = ("DATE", "TIME", "TIMESTAMP")

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


def _path_digest(parts: Tuple[str, ...]) -> str:  # noqa: UP006
    """Short digest of the *unsanitized* path, joined on a character no Snowflake
    identifier can contain so the encoding itself is unambiguous."""
    return hashlib.sha256("\x00".join(part or "" for part in parts).encode("utf-8")).hexdigest()[:_NAME_DIGEST_LENGTH]


def build_metric_name(service: str, database: str, schema: str, view: str, metric: str) -> str:
    """Globally-unique metric name as a single, dot-free FQN segment.

    A Metric's FQN *is* its name (``MetricRepository.setFullyQualifiedName``) and the
    server derives dimension/measure FQNs by appending to it, so a dot-separated name
    yields six-segment FQNs that positional FQN parsers read as
    ``service.database.schema.table.column``. We still qualify with the full path —
    the Metric namespace is flat, so a bare metric name would collide across
    schemas, databases and services — but join with ``METRIC_NAME_SEPARATOR`` so the
    whole thing stays one segment.

    The readable path alone does not identify the metric: ``_sanitize_name_part`` is
    lossy (``a.b`` and ``a_b`` both yield ``a_b``) and ``METRIC_NAME_SEPARATOR`` is
    itself legal inside a quoted identifier (``("x-y", "z")`` and ``("x", "y-z")``
    join to the same string). Either collision would silently overwrite one metric
    with another, so every name carries a digest of the raw path. It is deterministic,
    which the lineage workflow relies on to re-derive the name through this same
    function.
    """
    raw = (service, database, schema, view, metric)
    digest = _path_digest(raw)
    suffix = f"{METRIC_NAME_SEPARATOR}{digest}"
    path = METRIC_NAME_SEPARATOR.join(_sanitize_name_part(part) for part in raw)
    # Truncating the readable path never costs uniqueness -- that lives in the digest.
    return f"{path[: MAX_METRIC_NAME_LENGTH - len(suffix)]}{suffix}"


def infer_metric_type(expression: Optional[str]) -> MetricType:  # noqa: UP045
    """Infer the MetricType from the aggregation head of the expression."""
    result = MetricType.OTHER
    if expression:
        head = expression.strip().split("(")[0].strip().upper()
        result = _METRIC_TYPE_BY_PREFIX.get(head, MetricType.OTHER)
    return result


def _semantic_description(row) -> Optional[str]:  # noqa: UP045
    """Description for a dimension/measure: the Snowflake ``COMMENT``, plus any
    synonyms, which have nowhere else to land."""
    parts = []
    if row[SEMANTIC_COMMENT_IDX]:
        parts.append(str(row[SEMANTIC_COMMENT_IDX]))
    if row[SEMANTIC_SYNONYMS_IDX]:
        parts.append(f"Synonyms: {row[SEMANTIC_SYNONYMS_IDX]}.")
    return " ".join(parts) or None


def _dimension_type(data_type: Optional[str]) -> Optional[Type]:  # noqa: UP045
    """Classify a dimension as TIME or CATEGORICAL from its Snowflake data type."""
    result = None
    if data_type:
        upper = data_type.upper()
        result = Type.TIME if any(marker in upper for marker in _TIME_TYPE_MARKERS) else Type.CATEGORICAL
    return result


def _dimension(row) -> MetricDimension:
    return MetricDimension(  # pyright: ignore[reportCallIssue]
        name=row[SEMANTIC_NAME_IDX],
        type=_dimension_type(row[SEMANTIC_DATA_TYPE_IDX]),
        description=_semantic_description(row),
        expression=row[SEMANTIC_EXPRESSION_IDX] or None,
    )


def _measure(row) -> MetricMeasure:
    expression = row[SEMANTIC_EXPRESSION_IDX]
    aggregation = None
    if infer_metric_type(expression) != MetricType.OTHER:
        aggregation = expression.strip().split("(")[0].strip().upper()
    return MetricMeasure(  # pyright: ignore[reportCallIssue]
        name=row[SEMANTIC_NAME_IDX],
        aggregation=aggregation,
        description=_semantic_description(row),
        expression=expression or None,
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
        name=EntityName(build_metric_name(service, database, schema, view, metric)),
        displayName=metric,
        description=metric_row[SEMANTIC_COMMENT_IDX] or None,
        metricType=infer_metric_type(expression),
        metricExpression=metric_expression,
        dimensions=dimensions,
        measures=measures,
        assets=assets,
    )
