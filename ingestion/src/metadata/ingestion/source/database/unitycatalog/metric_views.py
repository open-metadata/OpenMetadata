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
Adapter that turns a Unity Catalog *metric view* into OpenMetadata ``Metric`` entities.

A metric view is declared as ``CREATE VIEW <v> WITH METRICS LANGUAGE YAML AS $$...$$``
and Unity Catalog stores the YAML body verbatim as the view's text. Each ``measures[]``
entry is a named aggregation over the view's source, so each becomes a first-class
``Metric`` carrying its expression, inferred type, the view's dimensions/measures, the
view-level ``filter``, and an ``assets`` link back to the metric-view table.

Everything here is pure: the caller supplies the YAML text and the already-resolved
entity references, so no Unity Catalog SQL or SDK call lives in this module.
"""

import re
from collections.abc import Iterable

import yaml
from pydantic import BaseModel, ConfigDict

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import (
    Language,
    MetricDimension,
    MetricExpression,
    MetricFilter,
    MetricMeasure,
    UnitOfMeasurement,
)
from metadata.generated.schema.type.basic import EntityName, Markdown
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.source.database.semantic_metrics import (
    aggregation_name,
    describe,
    dimension_type,
    infer_metric_type,
)
from metadata.ingestion.source.database.semantic_metrics import (
    build_metric_name as build_semantic_metric_name,
)

_FALLBACK_SERVICE_PREFIX = "unitycatalog"

# The alias Unity Catalog gives the metric view's own ``source`` inside expressions and
# join conditions (``source.o_custkey = customer.c_custkey``).
PRIMARY_SOURCE_ALIAS = "source"

# A single identifier segment: backtick-quoted or bare.
_IDENTIFIER = r"`[^`]*`|[A-Za-z_][\w$]*"
_IDENTIFIER_RE = re.compile(_IDENTIFIER)
# A dotted chain of identifier segments, e.g. ``customer.c_name`` or ``a.b.c``.
_DOTTED_CHAIN_RE = re.compile(rf"(?:{_IDENTIFIER})(?:\.(?:{_IDENTIFIER}))+")
# ``source`` when it is a bare relation reference rather than a SELECT statement.
_TABLE_REF_RE = re.compile(rf"^(?:{_IDENTIFIER})(?:\.(?:{_IDENTIFIER}))*$")
# A function head — ``SUM(`` — so ``SUM`` is not mistaken for a column reference.
_FUNCTION_CALL_RE = re.compile(rf"({_IDENTIFIER})\s*\(")
# A single- or double-quoted string literal. ``DATE_TRUNC('MONTH', d)`` would
# otherwise offer ``MONTH`` as a column candidate, and a date-dimension table really
# can have a column by that name — a literal must never reach column resolution.
_STRING_LITERAL_RE = re.compile(r"'(?:[^']|'')*'|\"(?:[^\"]|\"\")*\"")

# Bare words a Spark expression can contain that are never column references. The
# authoritative filter is resolution against the source table's real columns; this
# only keeps the obvious noise out of the lookup.
_SQL_KEYWORDS = frozenset(
    {
        "and",
        "as",
        "asc",
        "between",
        "by",
        "case",
        "cast",
        "desc",
        "distinct",
        "else",
        "end",
        "false",
        "filter",
        "following",
        "from",
        "in",
        "interval",
        "is",
        "like",
        "not",
        "null",
        "or",
        "order",
        "over",
        "partition",
        "preceding",
        "range",
        "rows",
        "then",
        "true",
        "unbounded",
        "when",
        "where",
    }
)


class MetricViewFormat(BaseModel):
    """The ``format:`` block of a field/measure — agent metadata used by AI/BI."""

    model_config = ConfigDict(extra="ignore")

    type: str | None = None
    currency_code: str | None = None


class MetricViewColumn(BaseModel):
    """One ``dimensions[]``/``fields[]``/``measures[]`` entry."""

    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    expr: str | None = None
    comment: str | None = None
    display_name: str | None = None
    synonyms: list[str] | None = None
    format: MetricViewFormat | None = None


class MetricViewJoin(BaseModel):
    """One ``joins[]`` entry. Only ``name`` (the alias expressions qualify with) and
    ``source`` matter for lineage; the ``on`` condition adds no new relation."""

    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    source: str | None = None


class MetricViewDefinition(BaseModel):
    """A parsed metric-view YAML body.

    ``dimensions`` was renamed ``fields`` in YAML version 1.1; both spellings are
    accepted so a view written against either version ingests the same way.
    """

    model_config = ConfigDict(extra="ignore")

    version: str | float | int | None = None
    comment: str | None = None
    source: str | None = None
    filter: str | None = None
    joins: list[MetricViewJoin] = []
    fields: list[MetricViewColumn] = []
    dimensions: list[MetricViewColumn] = []
    measures: list[MetricViewColumn] = []

    @property
    def all_dimensions(self) -> list[MetricViewColumn]:
        return [*self.fields, *self.dimensions]


class MetricViewParseError(ValueError):
    """A view's text is metric-view YAML but does not match the known schema."""


def parse_metric_view(view_text: str | None) -> MetricViewDefinition | None:
    """Parse a view's stored text as a metric-view YAML body, or return ``None``.

    This doubles as the metric-view discriminator. A catalog flag exists on current
    runtimes (``information_schema.tables.table_type = 'METRIC_VIEW'``, which is how
    the lineage workflow finds candidates to describe) but it is not available
    everywhere the sources read from, and the SDK's ``TableInfo.table_type`` is
    ``None`` for a metric view. The stored text is the one signal every path has: a
    metric view's text is YAML declaring ``measures``, and a SQL view's cannot be.
    ``yaml.safe_load`` of a SELECT yields a string, or at worst a mapping without
    ``measures``, so it never matches.

    Once the text *is* a metric view, a validation failure raises rather than
    returning ``None``: the two outcomes mean opposite things, and silently reusing
    "not a metric view" for "a metric view we could not read" would drop the view
    without a word.
    """
    payload = _metric_view_payload(view_text)
    if payload is None:
        return None
    try:
        return MetricViewDefinition.model_validate(payload)
    except Exception as err:
        raise MetricViewParseError(f"unrecognized metric view YAML: {err}") from err


def _metric_view_payload(view_text: str | None) -> dict | None:
    """The YAML mapping of a metric-view body, or ``None`` when the text is not one."""
    if not view_text or not view_text.strip():
        return None
    try:
        payload = yaml.safe_load(view_text)
    except yaml.YAMLError:
        return None
    if not isinstance(payload, dict) or not payload.get("measures"):
        return None
    return payload


def is_metric_view(view_text: str | None) -> bool:
    """``True`` when ``view_text`` is a metric view's YAML body.

    The discriminator on its own, for callers that must know *whether* a view is a
    metric view before deciding to pay for the text they would parse. It applies the
    same test as :func:`parse_metric_view` but never raises: a body that is a metric
    view yet fails validation still answers ``True`` here, so the caller goes on to
    fetch it and lets ``parse_metric_view`` report why it could not be read.
    """
    return _metric_view_payload(view_text) is not None


def build_metric_name(service: str, database: str, schema: str, view: str, measure: str) -> str:
    """Stable ``<service>-<digest>`` name for one measure of one metric view.

    A Metric's FQN *is* its name, so the identity has to carry every component that
    can repeat elsewhere: two catalogs, two schemas, or two views may each declare a
    ``Total Revenue``. Unlike Snowflake, a metric view's measure name is unique within
    its own view, so the view is the last scoping level.
    """
    return build_semantic_metric_name(
        service, database, schema, view, measure, fallback_prefix=_FALLBACK_SERVICE_PREFIX
    )


def _column_description(column: MetricViewColumn) -> str | None:
    """A field's description: its YAML ``comment`` plus its synonyms.

    The YAML gives synonyms as a list; the shared builder takes the rendered form
    because every source spells the list differently.
    """
    return describe(column.comment, ", ".join(column.synonyms) if column.synonyms else None)


def _unit_of_measurement(column: MetricViewColumn) -> tuple[UnitOfMeasurement | None, str | None]:
    """Map a measure's ``format:`` block to ``(unitOfMeasurement, custom unit)``.

    A non-USD currency has no matching enum member, so it rides along as OTHER plus
    the ISO code rather than being flattened onto DOLLARS.
    """
    fmt = column.format
    if fmt is None or not fmt.type:
        return None, None
    fmt_type = fmt.type.strip().lower()
    if fmt_type == "currency":
        code = (fmt.currency_code or "").strip().upper()
        if code in ("", "USD"):
            return UnitOfMeasurement.DOLLARS, None
        return UnitOfMeasurement.OTHER, code
    if fmt_type in ("percent", "percentage"):
        return UnitOfMeasurement.PERCENTAGE, None
    return None, None


def _dimensions(definition: MetricViewDefinition, column_types: dict[str, str]) -> list[MetricDimension] | None:
    dimensions = [
        MetricDimension(  # pyright: ignore[reportCallIssue]
            name=column.name,
            type=dimension_type(column_types.get(column.name)),
            description=_column_description(column),
            expression=column.expr or None,
        )
        for column in definition.all_dimensions
        if column.name
    ]
    return dimensions or None


def _measures(definition: MetricViewDefinition) -> list[MetricMeasure] | None:
    measures = [
        MetricMeasure(  # pyright: ignore[reportCallIssue]
            name=column.name,
            aggregation=aggregation_name(column.expr),
            description=_column_description(column),
            expression=column.expr or None,
        )
        for column in definition.measures
        if column.name
    ]
    return measures or None


def build_metric_request(
    service: str,
    database: str,
    schema: str,
    view: str,
    definition: MetricViewDefinition,
    measure: MetricViewColumn,
    column_types: dict[str, str],
    view_ref: EntityReference | None,
) -> CreateMetricRequest | None:
    """The ``CreateMetricRequest`` for one measure of a metric view.

    One measure per call so the caller can isolate a mapping failure to the metric
    that caused it. ``None`` when the measure has no ``name``: the name is the
    metric's whole identity, and one malformed entry must not cost the others.

    The view's full dimension and measure lists ride on every metric — a metric view
    declares them once for all its measures, and a Metric is only meaningful
    alongside the dimensions it can be sliced by.
    """
    if not measure.name:
        return None
    unit, custom_unit = _unit_of_measurement(measure)
    expression = measure.expr or None
    description = _column_description(measure) or definition.comment
    return CreateMetricRequest(  # pyright: ignore[reportCallIssue]
        name=EntityName(build_metric_name(service, database, schema, view, measure.name)),
        displayName=measure.display_name or measure.name,
        description=Markdown(description) if description else None,
        metricType=infer_metric_type(expression),
        metricExpression=(MetricExpression(language=Language.SQL, code=expression) if expression else None),
        unitOfMeasurement=unit,
        customUnitOfMeasurement=custom_unit,
        dimensions=_dimensions(definition, column_types),
        measures=_measures(definition),
        filters=[MetricFilter(where=definition.filter)] if definition.filter else None,
        assets=EntityReferenceList(root=[view_ref]) if view_ref is not None else None,
    )


def split_table_reference(reference: str) -> list[str]:
    """Split a ``catalog.schema.table`` reference into its unquoted segments."""
    return [segment.strip("`") for segment in _IDENTIFIER_RE.findall(reference or "")]


def is_table_reference(source: str | None) -> bool:
    """``True`` when ``source`` is a bare relation reference rather than a query.

    A metric view's ``source`` is either: ``samples.tpch.orders`` needs no SQL parsing,
    while ``SELECT * FROM ...`` does.
    """
    return bool(source) and bool(_TABLE_REF_RE.match(source.strip()))


def extract_column_refs(expression: str | None) -> list[tuple[str | None, str]]:
    """``(alias, column)`` references in an expression; ``alias`` is ``None`` when the
    reference is unqualified and therefore resolves against the primary source.

    Function heads (``SUM(``) and bare SQL keywords are dropped here; anything else is
    only a *candidate*, confirmed by resolving it against the source table's real
    columns.
    """
    text = _STRING_LITERAL_RE.sub(" ", expression or "")
    function_heads = {head.strip("`").lower() for head in _FUNCTION_CALL_RE.findall(text)}
    refs: list[tuple[str | None, str]] = []
    # One substitution over the whole text, not a replace() per chain: one chain can
    # be a prefix of another (``source.address`` and ``source.address.city``), and
    # replacing the shorter one by text would blank it inside the longer one and
    # leave ``city`` behind as a bare identifier that then resolves against the
    # primary source.
    remainder = _DOTTED_CHAIN_RE.sub(" ", text)
    for chain in _DOTTED_CHAIN_RE.findall(text):
        segments = split_table_reference(chain)
        if len(segments) >= 2:
            refs.append((".".join(segments[:-1]), segments[-1]))
    for identifier in _IDENTIFIER_RE.findall(remainder):
        name = identifier.strip("`")
        if name.lower() in _SQL_KEYWORDS or name.lower() in function_heads:
            continue
        refs.append((None, name))
    return refs


def resolve_alias(alias: str | None, join_names: Iterable[str]) -> str | None:
    """Map a reference's qualifier to the join it names, or ``None`` for the primary
    source.

    Nested joins are referenced with a dotted path (``customer.nation.n_name``), so
    match the longest join name that prefixes the qualifier rather than only its first
    segment. An unknown qualifier is most often a struct field on a primary-source
    column (``address.city``), so it falls back to the primary source and lets column
    resolution decide.
    """
    names = list(join_names)
    if alias is None or alias.lower() == PRIMARY_SOURCE_ALIAS:
        return None
    lowered = alias.lower()
    best = None
    for join_name in names:
        candidate = (join_name or "").lower()
        matches = candidate and (lowered == candidate or lowered.startswith(f"{candidate}."))
        if matches and (best is None or len(candidate) > len(best)):
            best = candidate
    if best is None:
        return None
    return next(name for name in names if (name or "").lower() == best)
