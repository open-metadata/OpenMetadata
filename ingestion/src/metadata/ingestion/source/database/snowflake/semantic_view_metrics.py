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
carrying its expression, inferred type, and the view's dimensions/facts. The
semantic-view lineage stage links the view to the metric after both entities exist.
Metric names are fully qualified because the ``Metric`` namespace is global
(FQN == name).
"""

import hashlib

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

# Column layout of INFORMATION_SCHEMA.SEMANTIC_{DIMENSIONS,FACTS,METRICS}:
# (TABLE_NAME, NAME, DATA_TYPE, EXPRESSION, COMMENT, SYNONYMS)
# TABLE_NAME (index 0) is unused: the owning logical table is already named by the
# expression (e.g. `customers.c_region`), so repeating it in the description is noise.
SEMANTIC_TABLE_IDX = 0
SEMANTIC_NAME_IDX = 1
SEMANTIC_DATA_TYPE_IDX = 2
SEMANTIC_EXPRESSION_IDX = 3
SEMANTIC_COMMENT_IDX = 4
SEMANTIC_SYNONYMS_IDX = 5

# Snowflake data types that make a dimension a TIME dimension rather than CATEGORICAL.
_TIME_TYPE_MARKERS = ("DATE", "TIME", "TIMESTAMP")

# A metric name is prefixed with its service so the global Metric namespace stays
# browsable by service; the digest after it carries the identity. Cap the prefix so a
# long service name cannot push the name past the 256-character entityName limit.
SERVICE_PREFIX_MAX_LEN = 64
_FALLBACK_SERVICE_PREFIX = "snowflake"

_METRIC_TYPE_BY_PREFIX = {
    "SUM": MetricType.SUM,
    "COUNT": MetricType.COUNT,
    "AVG": MetricType.AVERAGE,
    "MIN": MetricType.MIN,
    "MAX": MetricType.MAX,
}


def _unquote_name_part(part: str) -> str:
    """Normalize one identifier before hashing its canonical identity.

    Every derivation of a metric name starts here, because the two call sites
    disagree on quoting: the metadata stage passes the topology context value,
    which may be quoted, while the lineage workflow passes the raw
    INFORMATION_SCHEMA value, which never is. Normalizing before anything else
    keeps both paths on the same name for the same metric. Snowflake represents
    an embedded quote as ``""`` inside a quoted identifier; decode that wrapper
    representation without removing quotes that belong to the identifier itself.
    """
    value = part or ""
    if len(value) >= 2 and value.startswith('"') and value.endswith('"'):
        return value[1:-1].replace('""', '"')
    return value


def _service_prefix(service: str) -> str:
    """FQN-safe prefix derived from the OpenMetadata service name.

    A service name is user-defined and may carry ``.``, spaces, or ``::``, any of
    which would stop the metric name from being a single FQN segment --
    ``MetricRepository`` assigns the FQN from the raw name without quoting it. Map
    everything outside ``[alnum]``/``_``/``-`` to ``-``. This is deliberately lossy:
    the digest is what makes the name unique, so two services that flatten to the
    same prefix still produce different names.
    """
    safe = "".join(char if char.isalnum() or char in "_-" else "-" for char in _unquote_name_part(service))
    return safe[:SERVICE_PREFIX_MAX_LEN].strip("-") or _FALLBACK_SERVICE_PREFIX


def build_metric_name(service: str, database: str, schema: str, view: str, table: str, metric: str) -> str:
    """Stable ``<service>-<digest>`` name for a Snowflake semantic-view metric.

    A Metric's FQN is its name, so the name must be globally unique and remain one
    FQN-safe segment. Hash the complete canonical identity instead of exposing a
    lossy, separator-joined path, and lead with the service so the global Metric
    namespace is still browsable. ``displayName`` retains the Snowflake metric name
    for the UI.

    ``table`` is the *logical* table the metric is declared on. Snowflake scopes a
    semantic object's name to its logical table — every object is declared as
    ``<table_alias>.<name> AS <expr>`` — so one view may define both ``orders.total``
    and ``returns.total``, and the logical table is part of the metric's identity.

    NUL separates identity components because Snowflake identifiers cannot contain
    it, keeping part boundaries unambiguous. The full digest avoids introducing a
    connector-defined truncation collision and stays well below the entity-name
    length limit.
    """
    identity = tuple(_unquote_name_part(part) for part in (service, database, schema, view, table, metric))
    digest = hashlib.sha256("\x00".join(identity).encode("utf-8")).hexdigest()
    return f"{_service_prefix(service)}-{digest}"


def infer_metric_type(expression: str | None) -> MetricType:
    """Infer the MetricType from the aggregation head of the expression."""
    result = MetricType.OTHER
    if expression:
        head = expression.strip().split("(")[0].strip().upper()
        result = _METRIC_TYPE_BY_PREFIX.get(head, MetricType.OTHER)
    return result


def _semantic_description(row) -> str | None:
    """Description for a dimension/measure: the Snowflake ``COMMENT``, plus any
    synonyms, which have nowhere else to land."""
    parts = []
    if row[SEMANTIC_COMMENT_IDX]:
        parts.append(str(row[SEMANTIC_COMMENT_IDX]))
    if row[SEMANTIC_SYNONYMS_IDX]:
        parts.append(f"Synonyms: {row[SEMANTIC_SYNONYMS_IDX]}.")
    return " ".join(parts) or None


def _dimension_type(data_type: str | None) -> Type | None:
    """Classify a dimension as TIME or CATEGORICAL from its Snowflake data type."""
    result = None
    if data_type:
        upper = data_type.upper()
        result = Type.TIME if any(marker in upper for marker in _TIME_TYPE_MARKERS) else Type.CATEGORICAL
    return result


def _child_name(row) -> str:
    """``<logical table>.<name>`` for a Metric's dimension/measure children.

    The logical table is part of a semantic object's identity — Snowflake declares
    each as ``<table_alias>.<name>`` and permits the same name on two tables — and the
    server FQNs these children as ``<metric name>.dimension.<name>``. Without the
    qualifier a colliding pair produced two children sharing one FQN; unlike the
    Metric itself these models carry no ``displayName``, so the qualifier has to live
    in the name. The server quotes dotted child names when building their FQNs, so
    the Snowflake name does not need the Metric name's UI-specific sanitization.
    """
    return ".".join(_unquote_name_part(part) for part in (row[SEMANTIC_TABLE_IDX], row[SEMANTIC_NAME_IDX]))


def _dimension(row) -> MetricDimension:
    return MetricDimension(  # pyright: ignore[reportCallIssue]
        name=_child_name(row),
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
        name=_child_name(row),
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
    dimension_rows: list[tuple],
    fact_rows: list[tuple],
) -> CreateMetricRequest:
    """Assemble a CreateMetricRequest for a single Snowflake metric row."""
    metric = metric_row[SEMANTIC_NAME_IDX]
    table = metric_row[SEMANTIC_TABLE_IDX]
    expression = metric_row[SEMANTIC_EXPRESSION_IDX]
    dimensions = [_dimension(row) for row in dimension_rows] or None
    measures = [_measure(row) for row in fact_rows] or None
    metric_expression = MetricExpression(language=Language.SQL, code=expression) if expression else None
    return CreateMetricRequest(  # pyright: ignore[reportCallIssue]
        name=EntityName(build_metric_name(service, database, schema, view, table, metric)),
        displayName=metric,
        description=metric_row[SEMANTIC_COMMENT_IDX] or None,
        metricType=infer_metric_type(expression),
        metricExpression=metric_expression,
        dimensions=dimensions,
        measures=measures,
    )
