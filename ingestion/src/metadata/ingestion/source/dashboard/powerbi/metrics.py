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
Turn Power BI semantic-model measures into OpenMetadata ``Metric`` entities.

Unlike a Tableau numeric column, a Power BI measure only exists because a model author wrote
it in DAX, so every visible measure of a dataset is a business metric. Measures stay columns of
their data model as well; the Metric is an additional, first-class view of the same measure.
"""

import re
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
from metadata.ingestion.source.dashboard.powerbi.models import Dataset, PowerBiMeasures, PowerBiTable
from metadata.utils.metric_naming import build_metric_name

_FALLBACK_SERVICE_PREFIX = "powerbi"
_TIME_DATA_TYPES = {"datetime", "date", "datetimezone"}

_METRIC_TYPE_BY_FUNCTION = {
    "sum": MetricType.SUM,
    "sumx": MetricType.SUM,
    "average": MetricType.AVERAGE,
    "averagex": MetricType.AVERAGE,
    "count": MetricType.COUNT,
    "counta": MetricType.COUNT,
    "countx": MetricType.COUNT,
    "countax": MetricType.COUNT,
    "countrows": MetricType.COUNT,
    "distinctcount": MetricType.COUNT,
    "distinctcountnoblank": MetricType.COUNT,
    "min": MetricType.MIN,
    "minx": MetricType.MIN,
    "max": MetricType.MAX,
    "maxx": MetricType.MAX,
    "median": MetricType.MEDIAN,
    "medianx": MetricType.MEDIAN,
    "stdev.s": MetricType.STANDARD_DEVIATION,
    "stdev.p": MetricType.STANDARD_DEVIATION,
    "stdevx.s": MetricType.STANDARD_DEVIATION,
    "stdevx.p": MetricType.STANDARD_DEVIATION,
    "var.s": MetricType.VARIANCE,
    "var.p": MetricType.VARIANCE,
    "varx.s": MetricType.VARIANCE,
    "varx.p": MetricType.VARIANCE,
}

# Literals and identifiers are matched whole so a `//` or `--` inside them is not read as a comment.
_LEXEME = re.compile(
    r"\"(?:[^\"]|\"\")*\"|\[(?:[^\]]|\]\])*\]|'(?:[^']|'')*'|//[^\n]*|--[^\n]*|/\*.*?\*/",
    re.DOTALL,
)
_CALL = re.compile(r"^([\w.]+)\s*\((.*)\)$", re.DOTALL)
# `[Name]` is a measure; `Table[Name]` / `'My Table'[Name]` a column (or, rarely, a qualified measure).
_REFERENCE = re.compile(r"(?:'((?:[^']|'')+)'|(\w+))?\[((?:[^\]]|\]\])+)\]")


def powerbi_metric_name(service: str, dataset_id: str, measure_name: str) -> str:
    """Stable, globally unique name for a Power BI measure.

    Measure names are unique within a semantic model, and the scan API gives measures no id, so
    the dataset id plus the measure name is the measure's identity. See
    ``metadata.utils.metric_naming`` for why the readable name lives in ``displayName``.
    """
    return build_metric_name(service, (dataset_id, measure_name), _FALLBACK_SERVICE_PREFIX)


def _clean(expression: str | None) -> str:
    """The DAX expression without comments and with string literals emptied."""

    def keep(match: re.Match) -> str:
        lexeme = match.group(0)
        if lexeme[0] in "/-":
            return ""
        return '""' if lexeme[0] == '"' else lexeme

    return _LEXEME.sub(keep, expression or "").strip()


def _top_level_arguments(body: str) -> list[str] | None:
    """Split a call's argument list on top-level commas; None if a parenthesis closes early,
    i.e. the call does not span the whole expression (``SUM(a) / MIN(b)``)."""
    arguments: list[str] = []
    depth, start, closer = 0, 0, None
    for index, char in enumerate(body):
        if closer:
            if char == closer:
                closer = None
        elif char in "['\"":
            closer = "]" if char == "[" else char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth < 0:
                return None
        elif char == "," and depth == 0:
            arguments.append(body[start:index])
            start = index + 1
    arguments.append(body[start:])
    return arguments


def dax_aggregation(expression: str | None) -> str | None:
    """The aggregate a measure consists of, when the whole expression is one call.

    ``CALCULATE(SUM(Sales[Amount]), …)`` only filters its first argument, so that argument
    decides. ``VAR … RETURN`` bodies and arithmetic over several calls stay unclassified.
    """
    match = _CALL.match(_clean(expression))
    if not match:
        return None
    arguments = _top_level_arguments(match.group(2))
    if arguments is None:
        return None
    function = match.group(1).lower()
    if function == "calculate":
        return dax_aggregation(arguments[0])
    return match.group(1).upper() if function in _METRIC_TYPE_BY_FUNCTION else None


def map_metric_type(aggregation: str | None) -> MetricType:
    return _METRIC_TYPE_BY_FUNCTION.get((aggregation or "").lower(), MetricType.OTHER)


def map_unit_of_measurement(format_string: str | None) -> UnitOfMeasurement | None:
    """``0.00%`` is a percentage, ``\\$#,0.00`` currency. ``DOLLARS`` is the enum's only
    currency, so other currencies stay unset."""
    fmt = format_string or ""
    if "%" in fmt:
        return UnitOfMeasurement.PERCENTAGE
    if "$" in fmt:
        return UnitOfMeasurement.DOLLARS
    return None


def dax_references(expression: str | None) -> Iterator[tuple[str | None, str]]:
    """Every ``(table, name)`` a DAX expression references; ``table`` is None for ``[Name]``."""
    for quoted_table, table, name in _REFERENCE.findall(_clean(expression)):
        yield (quoted_table.replace("''", "'") or table or None), name.replace("]]", "]")


def _visible_measures(dataset: Dataset) -> dict[str, tuple[PowerBiTable, PowerBiMeasures]]:
    """The dataset's metric measures keyed by lower-cased name; DAX names are case-insensitive."""
    return {
        measure.name.lower(): (table, measure)
        for table in dataset.tables or []
        for measure in table.measures or []
        if measure.name and not measure.isHidden
    }


def related_measures(dataset: Dataset, measure: PowerBiMeasures) -> list[PowerBiMeasures]:
    """The other visible measures of the dataset that ``measure`` is computed from."""
    measures = _visible_measures(dataset)
    related: dict[str, PowerBiMeasures] = {}
    for table_name, name in dax_references(measure.expression):
        entry = measures.get(name.lower())
        if not entry or entry[1] is measure:
            continue
        home_table, candidate = entry
        if table_name is None or table_name.lower() == (home_table.name or "").lower():
            related[name.lower()] = candidate
    return list(related.values())


def referenced_columns(dataset: Dataset, measure: PowerBiMeasures) -> list[tuple[str, str]]:
    """``(table, column)`` names of the model columns ``measure`` reads, as the model spells them."""
    columns = {
        ((table.name or "").lower(), column.name.lower()): (table.name, column.name)
        for table in dataset.tables or []
        for column in table.columns or []
        if table.name and column.name
    }
    found: dict[tuple[str, str], tuple[str, str]] = {}
    for table_name, name in dax_references(measure.expression):
        key = ((table_name or "").lower(), name.lower())
        if table_name and key in columns:
            found[key] = columns[key]
    return list(found.values())


def metric_measures_parents_first(dataset: Dataset) -> list[tuple[PowerBiTable, PowerBiMeasures]]:
    """The dataset's visible measures, each after the measures it is computed from.

    ``relatedMetrics`` is resolved server-side on create, so a parent must be written first. A
    reference cycle is broken at whichever member is reached first.
    """
    measures = _visible_measures(dataset)
    ordered: list[tuple[PowerBiTable, PowerBiMeasures]] = []
    visited: set[str] = set()

    def visit(key: str) -> None:
        if key in visited:
            return
        visited.add(key)
        table, measure = measures[key]
        for parent in related_measures(dataset, measure):
            visit(parent.name.lower())  # pyright: ignore[reportOptionalMemberAccess]
        ordered.append((table, measure))

    for key in measures:
        visit(key)
    return ordered


def measure_dimensions(dataset: Dataset, home_table: PowerBiTable, measure: PowerBiMeasures) -> list[MetricDimension]:
    """Visible columns of the measure's home table and of the tables its DAX reads.

    ponytail: tables reachable only through model relationships are not included; read the
    scan's `relationships` if slicing across a star schema needs to show up here.
    """
    table_names = {(home_table.name or "").lower()} | {
        table.lower() for table, _ in referenced_columns(dataset, measure)
    }
    return [
        MetricDimension(  # pyright: ignore[reportCallIssue]
            name=column.name,
            type=Type.TIME if (column.dataType or "").lower() in _TIME_DATA_TYPES else Type.CATEGORICAL,
            description=column.description,
        )
        for table in dataset.tables or []
        if (table.name or "").lower() in table_names
        for column in table.columns or []
        if column.name and not column.isHidden
    ]


def build_metric_request(
    service: str,
    dataset: Dataset,
    measure: PowerBiMeasures,
    dimensions: list[MetricDimension],
    asset: EntityReference | None = None,
    related_metrics: list[str] | None = None,
) -> CreateMetricRequest:
    """Assemble the ``CreateMetricRequest`` for one measure. DAX is not SQL, hence ``External``."""
    aggregation = dax_aggregation(measure.expression)
    return CreateMetricRequest(  # pyright: ignore[reportCallIssue]
        name=EntityName(powerbi_metric_name(service, dataset.id, measure.name)),  # pyright: ignore[reportArgumentType]
        displayName=measure.name,
        description=Markdown(measure.description) if measure.description else None,
        metricType=map_metric_type(aggregation),
        metricExpression=MetricExpression(language=Language.External, code=measure.expression)  # pyright: ignore[reportCallIssue]
        if measure.expression
        else None,
        unitOfMeasurement=map_unit_of_measurement(measure.formatString),
        measures=[
            MetricMeasure(  # pyright: ignore[reportCallIssue]
                name=measure.name,  # pyright: ignore[reportArgumentType]
                aggregation=aggregation,
                description=measure.description,
                expression=measure.expression,
            )
        ],
        dimensions=dimensions or None,
        relatedMetrics=[FullyQualifiedEntityName(related) for related in related_metrics or []] or None,
        assets=EntityReferenceList(root=[asset]) if asset else None,
    )
