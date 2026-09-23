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
Turn LookML measures into OpenMetadata ``Metric`` entities.

A LookML measure is an aggregation over a view -- it has a type, an optional SQL body, filters
and a value format -- so representing it only as a ``Column`` on the view's data model loses
everything that makes it a metric. Each measure becomes a first-class ``Metric`` carrying its
expression, aggregation, filters, and the dimensions of the view it is declared on.

Measures reach us from two places, and both are needed:

* the Looker API (``explore.fields.measures``), which is available on every deployment and
  already resolves inheritance and refinements for us;
* the LookML files in the project repository, which are the only source for views no explore
  references, and the only place the exact filter syntax survives.

They are reconciled on the measure's *identity* -- ``(project, defining view, name)``. That is
what collapses a measure joined into a dozen explores, or inherited through ``extends``, into
one entity.
"""

import re
from collections.abc import Iterable, Iterator, Sequence
from typing import NamedTuple

from looker_sdk.sdk.api40.models import LookmlModelExplore, LookmlModelExploreField

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import (
    Language,
    MetricDimension,
    MetricExpression,
    MetricFilter,
    MetricMeasure,
    MetricType,
    Type,
    UnitOfMeasurement,
)
from metadata.generated.schema.entity.data.table import DataType
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName, Markdown
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.source.dashboard.looker.columns import LOOKER_TYPE_MAP
from metadata.ingestion.source.dashboard.looker.models import LookMlField, LookMlView
from metadata.utils.metric_naming import build_metric_name

_FALLBACK_SERVICE_PREFIX = "looker"

# LookML measure type -> MetricType. `number` is a computed measure (its SQL combines other
# measures), which is exactly what DERIVED means. Anything absent maps to OTHER rather than
# being guessed at.
_METRIC_TYPE_BY_MEASURE_TYPE = {
    "average": MetricType.AVERAGE,
    "average_distinct": MetricType.AVERAGE,
    "count": MetricType.COUNT,
    "count_distinct": MetricType.COUNT,
    "max": MetricType.MAX,
    "median": MetricType.MEDIAN,
    "median_distinct": MetricType.MEDIAN,
    "min": MetricType.MIN,
    "number": MetricType.DERIVED,
    "percent_of_previous": MetricType.PERCENTAGE,
    "percent_of_total": MetricType.PERCENTAGE,
    "percentile": MetricType.OTHER,
    "percentile_distinct": MetricType.OTHER,
    "running_total": MetricType.CUMULATIVE,
    "sum": MetricType.SUM,
    "sum_distinct": MetricType.SUM,
}

# `value_format_name` is a named Looker format. Only the families that carry an unambiguous
# unit are mapped; `decimal_2` and friends say how to render a number, not what it measures.
# `DOLLARS` is the enum's only currency, so a pound- or euro-denominated measure is OTHER with
# the currency preserved in `customUnitOfMeasurement` rather than being relabelled as dollars.
_UNIT_BY_VALUE_FORMAT_PREFIX: tuple[tuple[str, UnitOfMeasurement, str | None], ...] = (
    ("usd", UnitOfMeasurement.DOLLARS, None),
    ("gbp", UnitOfMeasurement.OTHER, "GBP"),
    ("eur", UnitOfMeasurement.OTHER, "EUR"),
    ("percent", UnitOfMeasurement.PERCENTAGE, None),
)

# LookML `hidden` is a yes/no string; the API reports the resolved boolean.
_TRUTHY_LOOKML_FLAGS = {"yes", "true"}

# LookML data types that make a dimension a TIME dimension rather than CATEGORICAL, expressed
# through the type map the column builder already uses so the two never disagree.
_TIME_DATA_TYPES = {DataType.DATE, DataType.TIME, DataType.DATETIME, DataType.TIMESTAMP}

# `${TABLE}.col`, where the identifier may be delimited and the delimiter is dialect specific:
# Snowflake uses ", Databricks/BigQuery `, MSSQL []. Kept in sync with the equivalent pattern in
# `metadata.py::_extract_column_lineage`.
_TABLE_COLUMN_PATTERN = re.compile(r'\$\{TABLE\}\.(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([a-zA-Z_][a-zA-Z0-9_]*))')
_FIELD_REFERENCE_PATTERN = re.compile(r"\$\{(?!TABLE\})([a-zA-Z_][a-zA-Z0-9_]*)\}")


class MeasureCandidate(NamedTuple):
    """One LookML measure, normalized away from whichever source produced it.

    ``key`` is the identity that deduplicates: the same measure seen through three explores and
    through the LookML file is one candidate, not four.
    """

    project: str
    view: str
    name: str
    label: str | None
    description: str | None
    measure_type: str | None
    sql: str | None
    filters: list[str]
    value_format_name: str | None
    tags: list[str]
    dimensions: list[MetricDimension]
    from_lookml: bool

    @property
    def key(self) -> tuple[str, str, str]:
        return (self.project, self.view, self.name)


def looker_metric_name(service: str, project: str, view: str, measure: str) -> str:
    """Stable, globally unique name for a LookML measure.

    A ``Metric``'s FQN is its name, so the name cannot be the LookML one -- two Looker services,
    or two projects in one service, routinely declare ``orders.count``. The readable name lives
    in ``displayName``; see ``metadata.utils.metric_naming``.
    """
    return build_metric_name(service, (project, view, measure), _FALLBACK_SERVICE_PREFIX)


def map_metric_type(measure_type: str | None) -> MetricType:
    return _METRIC_TYPE_BY_MEASURE_TYPE.get((measure_type or "").lower(), MetricType.OTHER)


def map_unit_of_measurement(value_format_name: str | None) -> tuple[UnitOfMeasurement | None, str | None]:
    """The measure's unit, plus the custom unit that names it when the enum cannot.

    Returned together because the two fields are only valid as a pair: the schema defines
    ``customUnitOfMeasurement`` as the name of the unit when ``unitOfMeasurement`` is ``OTHER``.
    """
    lowered = (value_format_name or "").lower()
    for prefix, unit, custom_unit in _UNIT_BY_VALUE_FORMAT_PREFIX:
        if lowered.startswith(prefix):
            return unit, custom_unit
    return None, None


def measure_references(sql: str | None) -> list[str]:
    """The ``${field}`` references in a measure's SQL, in order, without duplicates.

    ``${TABLE}`` is excluded: it is the view's own table, not a field.
    """
    seen: dict[str, None] = {}
    for reference in _FIELD_REFERENCE_PATTERN.findall(sql or ""):
        seen.setdefault(reference, None)
    return list(seen)


def table_column_references(sql: str | None, field_sql: dict[str, str | None]) -> set[str]:
    """Source columns a SQL body reads, resolving ``${field}`` references transitively.

    A measure rarely names its columns directly -- ``${total_revenue} / ${count}`` reaches the
    underlying columns only through two other fields. ``field_sql`` maps every field of the view
    to its SQL so the walk can follow them. Cycles terminate: LookML does not forbid a field
    referencing itself through another, and one malformed view must not hang the run.
    """

    def resolve(body: str | None, visited: set[str]) -> set[str]:
        columns = {
            next(group for group in match.groups() if group) for match in _TABLE_COLUMN_PATTERN.finditer(body or "")
        }
        for reference in _FIELD_REFERENCE_PATTERN.findall(body or ""):
            if reference in visited or reference not in field_sql:
                continue
            visited.add(reference)
            columns.update(resolve(field_sql[reference], visited))
        return columns

    return resolve(sql, set())


def _render_lookml_filter(field: str | None, value: str | None) -> str | None:
    """Render one filter as LookML, e.g. ``status: complete``.

    Deliberately *not* rendered as a SQL predicate: a Looker filter condition is a Looker filter
    expression (``>10``, ``-NULL``, ``30 days``, ``NOT NULL``), and turning those into SQL would
    be invention that cannot round-trip back to the LookML the user wrote.
    """
    if not field:
        return None
    return f"{field}: {value}" if value else field


def _filters_from_lookml(field: LookMlField) -> list[str]:
    """Normalize the two LookML filter syntaxes.

    ``filters: [status: "complete"]`` parses to ``[[{"status": "complete"}]]`` while the legacy
    ``filters: { field: status  value: "x" }`` parses to ``[{"field": ..., "value": ...}]``, so
    both an entry and a list of entries have to be handled.
    """
    filters: list[str] = []

    def add(entry: object) -> None:
        if isinstance(entry, list):
            for item in entry:
                add(item)
        elif isinstance(entry, dict):
            if "field" in entry:
                rendered = _render_lookml_filter(entry.get("field"), entry.get("value"))
                if rendered:
                    filters.append(rendered)
            else:
                filters.extend(
                    rendered for name, value in entry.items() if (rendered := _render_lookml_filter(name, value))
                )

    add(field.filters__all)
    return filters


def _filters_from_api(field: LookmlModelExploreField) -> list[str]:
    return [
        rendered
        for measure_filter in field.filters or []
        if (rendered := _render_lookml_filter(measure_filter.field, measure_filter.condition))
    ]


def _dimension(field: LookMlField | LookmlModelExploreField, name: str) -> MetricDimension:
    data_type = LOOKER_TYPE_MAP.get(field.type or "", DataType.UNKNOWN)
    return MetricDimension(  # pyright: ignore[reportCallIssue]
        name=name,
        type=Type.TIME if data_type in _TIME_DATA_TYPES else Type.CATEGORICAL,
        description=field.description,
        expression=field.sql,
    )


def _is_hidden(field: LookMlField | LookmlModelExploreField) -> bool:
    """Whether the field is hidden from Looker's own field picker.

    A hidden measure is an intermediate a visible measure is built from, not something a user
    can chart. It must not become a Metric: names are globally unique across the instance, so
    every hidden helper would take a permanent slot in that namespace for nothing.
    """
    hidden = field.hidden
    if isinstance(hidden, str):
        return hidden.strip().lower() in _TRUTHY_LOOKML_FLAGS
    return bool(hidden)


def _view_dimensions(view: LookMlView) -> list[MetricDimension]:
    """The fields the view's measures can be sliced by.

    Dimension groups are included: to a consumer of the metric, ``created`` is just as much a
    dimension as ``status``, and it is the one that makes the metric time-sliceable.
    """
    return [_dimension(field, field.name) for field in (*view.dimensions, *view.dimension_groups)]


def _explore_dimensions(model: LookmlModelExplore, view: str) -> list[MetricDimension]:
    """Explore dimensions belonging to one view, named without the view qualifier.

    The API reports a field as ``view.field``; the view is already the metric's identity, so
    repeating it in every dimension name would be noise.

    Dropping the qualifier is also what makes one view joined twice -- ``billing.status`` and
    ``shipping.status``, both declared by the same view -- collapse back into the one ``status``
    dimension the view actually declares, instead of repeating it once per join alias.
    """
    dimensions: dict[str, MetricDimension] = {}
    for field in (model.fields.dimensions if model.fields else None) or []:
        field_view, _, short_name = (field.name or "").partition(".")
        if short_name and (field.original_view or field_view) == view:
            dimensions.setdefault(short_name, _dimension(field, short_name))
    return list(dimensions.values())


def candidates_from_view(view: LookMlView, project: str) -> list[MeasureCandidate]:
    """Measures declared in a LookML view file."""
    dimensions = _view_dimensions(view)
    return [
        MeasureCandidate(
            project=project,
            view=view.name,
            name=measure.name,
            label=measure.label,
            description=measure.description,
            measure_type=measure.type,
            sql=measure.sql,
            filters=_filters_from_lookml(measure),
            value_format_name=measure.value_format_name,
            tags=measure.tags or [],
            dimensions=dimensions,
            from_lookml=True,
        )
        for measure in view.measures
        if not _is_hidden(measure)
    ]


def candidates_from_explore(model: LookmlModelExplore, project: str) -> list[MeasureCandidate]:
    """Measures surfaced by an explore, attributed to the view that declares them.

    ``view`` is the join alias -- the same view joined twice under two names -- while
    ``original_view`` is where the measure is actually declared, so the latter wins. That is
    what keeps an aliased join from creating a second copy of the same metric.
    """
    candidates = []
    for field in (model.fields.measures if model.fields else None) or []:
        if not field.measure or not field.name or _is_hidden(field):
            continue
        field_view, _, short_name = field.name.partition(".")
        view = field.original_view or field.view or field_view
        if not short_name or not view:
            continue
        candidates.append(
            MeasureCandidate(
                project=field.project_name or project,
                view=view,
                name=short_name,
                label=field.label_short or field.label,
                description=field.description,
                measure_type=field.type,
                sql=field.sql,
                filters=_filters_from_api(field),
                value_format_name=field.value_format_name,
                tags=list(field.tags or []),
                dimensions=_explore_dimensions(model, view),
                from_lookml=False,
            )
        )
    return candidates


def _backfill_from_api(lookml: MeasureCandidate, api: MeasureCandidate) -> MeasureCandidate:
    """The LookML candidate, with anything it does not declare taken from the API one.

    LookML wins field by field rather than wholesale because the parser reads view files
    verbatim: it does not resolve ``extends``, so a child view that overrides only a measure's
    ``label`` parses to a measure with no type, no SQL and no filters. Replacing the
    API-resolved candidate with that would turn a `sum` into an untyped metric with no
    expression. The API has already applied inheritance and refinements, so it is the right
    source for everything the LookML declaration is silent about.
    """
    return lookml._replace(
        label=lookml.label or api.label,
        description=lookml.description or api.description,
        measure_type=lookml.measure_type or api.measure_type,
        sql=lookml.sql or api.sql,
        value_format_name=lookml.value_format_name or api.value_format_name,
        tags=lookml.tags or api.tags,
        filters=lookml.filters or api.filters,
        dimensions=lookml.dimensions or api.dimensions,
    )


def merge_candidates(
    known: dict[tuple[str, str, str], MeasureCandidate],
    incoming: Iterable[MeasureCandidate],
) -> dict[tuple[str, str, str], MeasureCandidate]:
    """Fold candidates into the known set, LookML winning over the API for one identity.

    LookML is richer where it speaks -- it keeps the exact filter syntax and the raw ``sql`` the
    user wrote -- so it wins field by field over an API-sourced candidate, but does not erase
    what it leaves unsaid. Two candidates from the same source are the same measure seen twice,
    and the first is kept.
    """
    for candidate in incoming:
        existing = known.get(candidate.key)
        if existing is None:
            known[candidate.key] = candidate
        elif candidate.from_lookml and not existing.from_lookml:
            known[candidate.key] = _backfill_from_api(candidate, existing)
    return known


def order_parents_first(known: dict[tuple[str, str, str], MeasureCandidate]) -> list[MeasureCandidate]:
    """Candidates ordered so that every measure a candidate references comes before it.

    ``relatedMetrics`` is resolved server-side when the metric is *created*, so a derived
    measure whose parent has not been written yet is rejected. Collection order gives no such
    guarantee: the Looker API lists an explore's fields alphabetically, which puts
    ``avg_revenue`` before the ``${total_revenue}`` it is computed from.

    A reference cycle -- which LookML rejects, but which nothing here can rely on -- is broken
    at whichever member is reached first, so the walk terminates instead of recursing forever.
    """
    ordered: list[MeasureCandidate] = []
    visited: set[tuple[str, str, str]] = set()

    def visit(candidate: MeasureCandidate) -> None:
        if candidate.key in visited:
            return
        visited.add(candidate.key)
        for reference in measure_references(candidate.sql):
            parent = known.get((candidate.project, candidate.view, reference))
            if parent is not None:
                visit(parent)
        ordered.append(candidate)

    for candidate in known.values():
        visit(candidate)
    return ordered


def build_metric_request(
    service: str,
    candidate: MeasureCandidate,
    assets: Sequence[EntityReference] = (),
    related_metrics: Sequence[str] = (),
    tag_labels: Sequence[TagLabel] | None = None,
) -> CreateMetricRequest:
    """Assemble the ``CreateMetricRequest`` for one LookML measure.

    ``metricExpression`` carries the measure's ``sql`` verbatim and is omitted when the measure
    has none (``type: count`` has no body). Synthesising ``COUNT(*)`` would put SQL in the
    entity that Looker never wrote and that could not be compared back to the source; the
    aggregation is preserved losslessly on the measure child instead.
    """
    unit, custom_unit = map_unit_of_measurement(candidate.value_format_name)
    return CreateMetricRequest(  # pyright: ignore[reportCallIssue]
        name=EntityName(looker_metric_name(service, candidate.project, candidate.view, candidate.name)),
        displayName=candidate.label or candidate.name,
        description=Markdown(candidate.description) if candidate.description else None,
        metricType=map_metric_type(candidate.measure_type),
        metricExpression=(
            MetricExpression(language=Language.SQL, code=candidate.sql) if candidate.sql else None  # pyright: ignore[reportCallIssue]
        ),
        unitOfMeasurement=unit,
        customUnitOfMeasurement=custom_unit,
        measures=[
            MetricMeasure(  # pyright: ignore[reportCallIssue]
                name=candidate.name,
                aggregation=candidate.measure_type,
                description=candidate.description,
                expression=candidate.sql,
            )
        ],
        dimensions=candidate.dimensions or None,
        filters=[MetricFilter(where=where) for where in candidate.filters] or None,
        relatedMetrics=[FullyQualifiedEntityName(name) for name in related_metrics] or None,
        assets=EntityReferenceList(root=list(assets)) if assets else None,
        tags=list(tag_labels) if tag_labels else None,
    )


def related_metric_names(
    service: str,
    candidate: MeasureCandidate,
    known: dict[tuple[str, str, str], MeasureCandidate],
) -> Iterator[str]:
    """Names of the metrics a measure is computed from.

    Only references that resolve to another measure *of the same view* are followed: a
    ``${field}`` reference in LookML is view-scoped, and a reference to a dimension is not a
    metric dependency.
    """
    for reference in measure_references(candidate.sql):
        parent = known.get((candidate.project, candidate.view, reference))
        if parent is not None:
            yield looker_metric_name(service, parent.project, parent.view, parent.name)
