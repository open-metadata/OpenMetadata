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
Rules shared by every semantic-layer metric ingestion path.

A semantic layer -- a Snowflake semantic view, a Databricks metric view -- declares
named measures over named dimensions, and every connector that turns those into
OpenMetadata ``Metric`` entities faces the same three questions: what to name the
metric, what ``MetricType`` its expression implies, and whether a dimension is TIME or
CATEGORICAL. The answers live here, once, so a connector that learns a new aggregation
teaches every other connector at the same time.

What is *not* here: how a connector discovers its semantic objects, and how it maps a
row or a YAML node onto these primitives. Those differ per source and stay in the
connector.
"""

from metadata.generated.schema.entity.data.metric import MetricType, Type
from metadata.utils import metric_naming


def unquote_name_part(part: str) -> str:
    """Normalize one identifier before hashing its canonical identity.

    Call sites disagree on quoting: a metadata stage passes the topology context
    value, which may be quoted, while a lineage workflow passes the raw catalog
    value, which never is. Normalizing before anything else keeps both paths on the
    same name for the same metric. A double-quoted identifier represents an embedded
    quote as ``""``; decode that wrapper representation without removing quotes that
    belong to the identifier itself.
    """
    value = part or ""
    if len(value) >= 2 and value.startswith('"') and value.endswith('"'):
        return value[1:-1].replace('""', '"')
    return value


def build_metric_name(service: str, *identity: str, fallback_prefix: str) -> str:
    """Stable ``<service>-<digest>`` name for one semantic-layer metric.

    ``identity`` is the connector's ordered identity for the metric (database,
    schema, view, ... , metric). Every part is unquoted first so quoted and raw
    catalog values hash to the same name; ``metric_naming`` owns the hashing so
    semantic-layer metrics share one namespace scheme with every other source.
    """
    service, *parts = (unquote_name_part(part) for part in (service, *identity))
    return metric_naming.build_metric_name(service, tuple(parts), fallback_prefix)


_METRIC_TYPE_BY_HEAD = {
    "SUM": MetricType.SUM,
    "COUNT": MetricType.COUNT,
    "COUNT_IF": MetricType.COUNT,
    "APPROX_COUNT_DISTINCT": MetricType.COUNT,
    "AVG": MetricType.AVERAGE,
    "MEAN": MetricType.AVERAGE,
    "MIN": MetricType.MIN,
    "MAX": MetricType.MAX,
    "MEDIAN": MetricType.MEDIAN,
    "MODE": MetricType.MODE,
    "STDDEV": MetricType.STANDARD_DEVIATION,
    "STDDEV_POP": MetricType.STANDARD_DEVIATION,
    "STDDEV_SAMP": MetricType.STANDARD_DEVIATION,
    "VARIANCE": MetricType.VARIANCE,
    "VAR_POP": MetricType.VARIANCE,
    "VAR_SAMP": MetricType.VARIANCE,
}

# Substrings that make a dimension's declared type a TIME dimension. Matched as
# substrings so they cover the warehouses' spellings at once -- Snowflake's
# ``TIMESTAMP_NTZ``, Spark's ``timestamp_ltz``, plain ``DATE``.
TIME_TYPE_MARKERS = ("DATE", "TIME", "TIMESTAMP")


def _aggregation_head(expression: str | None) -> str | None:
    """The function name an expression opens with, e.g. ``SUM`` for ``SUM(x)``."""
    if not expression:
        return None
    return expression.strip().split("(")[0].strip().upper() or None


def infer_metric_type(expression: str | None) -> MetricType:
    """The MetricType implied by a measure expression's leading aggregation."""
    head = _aggregation_head(expression)
    if head is None:
        return MetricType.OTHER
    return _METRIC_TYPE_BY_HEAD.get(head, MetricType.OTHER)


def aggregation_name(expression: str | None) -> str | None:
    """The aggregation function's name, when it is one OpenMetadata models.

    Gated on ``infer_metric_type`` rather than returning any leading token, so a
    composed measure (``MEASURE(a) / MEASURE(b)``) does not report ``MEASURE`` as its
    aggregation.
    """
    if infer_metric_type(expression) == MetricType.OTHER:
        return None
    return _aggregation_head(expression)


def dimension_type(data_type: str | None) -> Type | None:
    """Classify a dimension as TIME or CATEGORICAL from its declared data type.

    ``None`` when the source did not give us a type -- an unknown dimension carries no
    type rather than a guessed one.
    """
    if not data_type:
        return None
    upper = data_type.upper()
    return Type.TIME if any(marker in upper for marker in TIME_TYPE_MARKERS) else Type.CATEGORICAL


def describe(comment: str | None, synonyms: str | None) -> str | None:
    """A dimension/measure description: the source ``COMMENT`` plus its synonyms.

    Synonyms are agent/search metadata with no field of their own on
    ``MetricDimension``/``MetricMeasure``, so they ride in the description or they are
    lost.
    """
    parts = []
    if comment:
        parts.append(str(comment))
    if synonyms:
        parts.append(f"Synonyms: {synonyms}.")
    return " ".join(parts) or None
