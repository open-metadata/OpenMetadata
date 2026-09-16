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

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import (
    Language,
    MetricDimension,
    MetricExpression,
    MetricMeasure,
)
from metadata.generated.schema.type.basic import EntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.source.database.semantic_metrics import (
    aggregation_name,
    describe,
    dimension_type,
    infer_metric_type,
    unquote_name_part,
)
from metadata.ingestion.source.database.semantic_metrics import (
    build_metric_name as build_semantic_metric_name,
)

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

# A metric name is prefixed with its service so the global Metric namespace stays
# browsable by service; the digest after it carries the identity. Cap the prefix so a
# long service name cannot push the name past the 256-character entityName limit.
_FALLBACK_SERVICE_PREFIX = "snowflake"


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
    return build_semantic_metric_name(
        service, database, schema, view, table, metric, fallback_prefix=_FALLBACK_SERVICE_PREFIX
    )


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
    return ".".join(unquote_name_part(part) for part in (row[SEMANTIC_TABLE_IDX], row[SEMANTIC_NAME_IDX]))


def _row_description(row) -> str | None:
    """A semantic object's description: its Snowflake ``COMMENT`` plus its synonyms."""
    return describe(row[SEMANTIC_COMMENT_IDX], row[SEMANTIC_SYNONYMS_IDX])


def _dimension(row) -> MetricDimension:
    return MetricDimension(  # pyright: ignore[reportCallIssue]
        name=_child_name(row),
        type=dimension_type(row[SEMANTIC_DATA_TYPE_IDX]),
        description=_row_description(row),
        expression=row[SEMANTIC_EXPRESSION_IDX] or None,
    )


def _measure(row) -> MetricMeasure:
    expression = row[SEMANTIC_EXPRESSION_IDX]
    return MetricMeasure(  # pyright: ignore[reportCallIssue]
        name=_child_name(row),
        aggregation=aggregation_name(expression),
        description=_row_description(row),
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
    view_ref: EntityReference | None,
) -> CreateMetricRequest:
    """Assemble a CreateMetricRequest for a single Snowflake metric row."""
    metric = metric_row[SEMANTIC_NAME_IDX]
    table = metric_row[SEMANTIC_TABLE_IDX]
    expression = metric_row[SEMANTIC_EXPRESSION_IDX]
    dimensions = [_dimension(row) for row in dimension_rows] or None
    measures = [_measure(row) for row in fact_rows] or None
    metric_expression = MetricExpression(language=Language.SQL, code=expression) if expression else None
    assets = EntityReferenceList(root=[view_ref]) if view_ref is not None else None
    return CreateMetricRequest(  # pyright: ignore[reportCallIssue]
        name=EntityName(build_metric_name(service, database, schema, view, table, metric)),
        displayName=metric,
        description=metric_row[SEMANTIC_COMMENT_IDX] or None,
        metricType=infer_metric_type(expression),
        metricExpression=metric_expression,
        dimensions=dimensions,
        measures=measures,
        assets=assets,
    )
