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
Turn Tableau calculated measures into OpenMetadata ``Metric`` entities.

Only a ``CalculatedField`` whose role is ``MEASURE`` becomes a Metric. Tableau assigns the
measure role to every numeric column by default, so a plain ``ColumnField`` measure is a
physical column, not an authored business definition -- ingesting those would put every
numeric column of every datasource into the global Metric namespace. A calculated measure is
what a Tableau author writes on purpose, the counterpart of a LookML measure.

A field reached through a published datasource is reported by the embedded datasource as a
bare field with no role, so each measure is ingested once, from the datasource defining it.
"""

from collections.abc import Iterator

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import (
    Language,
    MetricDimension,
    MetricExpression,
    MetricMeasure,
    MetricType,
    Type,
    UnitOfMeasurement,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName, Markdown
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.source.dashboard.tableau.models import DataSource, DatasourceField
from metadata.utils.metric_naming import build_metric_name

_FALLBACK_SERVICE_PREFIX = "tableau"
_MEASURE_ROLE = "MEASURE"
_DIMENSION_ROLE = "DIMENSION"
_TIME_DATA_TYPES = {"DATE", "DATETIME"}

# Tableau's default aggregation for the measure. An aggregate calculation (``SUM([a]) /
# SUM([b])``) carries its aggregation in the formula instead, and anything unlisted maps to
# OTHER rather than being guessed at.
_METRIC_TYPE_BY_AGGREGATION = {
    "sum": MetricType.SUM,
    "avg": MetricType.AVERAGE,
    "count": MetricType.COUNT,
    "countd": MetricType.COUNT,
    "min": MetricType.MIN,
    "max": MetricType.MAX,
    "median": MetricType.MEDIAN,
    "stdev": MetricType.STANDARD_DEVIATION,
    "stdevp": MetricType.STANDARD_DEVIATION,
    "var": MetricType.VARIANCE,
    "varp": MetricType.VARIANCE,
}


def tableau_metric_name(service: str, datasource_id: str, field_id: str) -> str:
    """Stable, globally unique name for a Tableau calculated measure.

    A ``Metric``'s FQN is its name, and two datasources routinely both declare ``Profit
    Ratio``, so the readable name lives in ``displayName``; see ``metadata.utils.metric_naming``.
    """
    return build_metric_name(service, (datasource_id, field_id), _FALLBACK_SERVICE_PREFIX)


def is_metric_field(field: DatasourceField) -> bool:
    return bool(field.formula) and (field.role or "").upper() == _MEASURE_ROLE and not field.isHidden


def map_metric_type(aggregation: str | None) -> MetricType:
    return _METRIC_TYPE_BY_AGGREGATION.get((aggregation or "").lower(), MetricType.OTHER)


def map_unit_of_measurement(default_format: str | None) -> UnitOfMeasurement | None:
    """Unit from Tableau's number format string: ``p0.00%`` is a percentage, ``c"$"#,##0``
    is currency. ``DOLLARS`` is the enum's only currency, so other currencies stay unset."""
    fmt = default_format or ""
    if fmt.startswith("p"):
        return UnitOfMeasurement.PERCENTAGE
    if fmt.startswith("c") and "$" in fmt:
        return UnitOfMeasurement.DOLLARS
    return None


def metric_fields_parents_first(datasource: DataSource) -> list[DatasourceField]:
    """The datasource's metric fields, each after the metric fields it is computed from.

    ``relatedMetrics`` is resolved server-side on create, so a parent must be written first. A
    reference cycle is broken at whichever member is reached first.
    """
    metric_fields = {field.id: field for field in datasource.fields or [] if is_metric_field(field)}
    ordered: list[DatasourceField] = []
    visited: set[str] = set()

    def visit(field: DatasourceField) -> None:
        if field.id in visited:
            return
        visited.add(field.id)
        for upstream in field.upstreamFields or []:
            if upstream and upstream.id in metric_fields:
                visit(metric_fields[upstream.id])
        ordered.append(field)

    for field in metric_fields.values():
        visit(field)
    return ordered


def related_metric_names(service: str, datasource: DataSource, field: DatasourceField) -> Iterator[str]:
    """Names of the metrics of the same datasource that ``field`` is computed from."""
    metric_ids = {candidate.id for candidate in datasource.fields or [] if is_metric_field(candidate)}
    for upstream in field.upstreamFields or []:
        if upstream and upstream.id in metric_ids and upstream.id != field.id:
            yield tableau_metric_name(service, datasource.id, upstream.id)


def datasource_dimensions(datasource: DataSource) -> list[MetricDimension]:
    """The fields the datasource's measures can be sliced by."""
    return [
        MetricDimension(  # pyright: ignore[reportCallIssue]
            name=field.name or field.id,
            type=Type.TIME if (field.dataType or "").upper() in _TIME_DATA_TYPES else Type.CATEGORICAL,
            description=field.description,
            expression=field.formula,
        )
        for field in datasource.fields or []
        if (field.role or "").upper() == _DIMENSION_ROLE and not field.isHidden
    ]


def build_metric_request(
    service: str,
    datasource: DataSource,
    field: DatasourceField,
    dimensions: list[MetricDimension],
    asset: EntityReference | None = None,
    related_metrics: list[str] | None = None,
) -> CreateMetricRequest:
    """Assemble the ``CreateMetricRequest`` for one calculated measure.

    The formula is Tableau's calculation language, not SQL, hence ``External``.
    """
    name = field.name or field.id
    return CreateMetricRequest(  # pyright: ignore[reportCallIssue]
        name=EntityName(tableau_metric_name(service, datasource.id, field.id)),
        displayName=name,
        description=Markdown(field.description) if field.description else None,
        metricType=map_metric_type(field.aggregation),
        metricExpression=MetricExpression(language=Language.External, code=field.formula),  # pyright: ignore[reportCallIssue]
        unitOfMeasurement=map_unit_of_measurement(field.defaultFormat),
        measures=[
            MetricMeasure(  # pyright: ignore[reportCallIssue]
                name=name,
                aggregation=field.aggregation,
                description=field.description,
                expression=field.formula,
            )
        ],
        dimensions=dimensions or None,
        relatedMetrics=[FullyQualifiedEntityName(related) for related in related_metrics or []] or None,
        assets=EntityReferenceList(root=[asset]) if asset else None,
    )
