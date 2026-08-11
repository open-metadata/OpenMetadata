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
"""Snowflake semantic-view lineage: expression resolution and wire requests.

Walks each semantic view's dim/fact/metric expressions to resolve every
referenced physical base column, following intra-view metric→fact→physical
chains with bounded depth. Edges carry bare column names — the owning table
FQNs live on the edge and on the caller — so a run can buffer many edges
cheaply and materialize the request objects only at emission.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from metadata.generated.schema.type.entityLineage import ColumnLineage, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.ingestion.models.ometa_lineage import OMetaFQNLineageRequest

if TYPE_CHECKING:
    from collections.abc import Iterable

    from metadata.ingestion.source.database.snowflake.semantic_view.catalog import (
        SemanticViewCatalog,
    )

_EXPRESSION_TOKEN = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)")
_MAX_INDIRECTION_DEPTH = 5

_ROW_TABLE_IDX = 0
_ROW_NAME_IDX = 1
_ROW_EXPR_IDX = 3

_TABLE = "table"
_METRIC = "metric"


class ColumnLineageEdge:
    """One base-column → view-column pair, named relative to their tables."""

    __slots__ = ("from_column", "to_column")

    def __init__(self, from_column: str, to_column: str) -> None:
        self.from_column = from_column
        self.to_column = to_column


class BaseTableEdge:
    """One physical base table with the column pairs feeding its view."""

    __slots__ = ("base_table_fqn", "columns")

    def __init__(self, base_table_fqn: str, columns: list[ColumnLineageEdge]) -> None:
        self.base_table_fqn = base_table_fqn
        self.columns = columns


def build_view_lineage(
    *,
    catalog: SemanticViewCatalog,
    base_table_fqns_by_logical: dict[str, str],
) -> list[BaseTableEdge]:
    """Return one BaseTableEdge per physical base table this view derives from.

    ``base_table_fqns_by_logical`` maps logical table names (as they appear in
    expressions, lowercased) to the OM Table FQN of the physical base table.
    """
    logical_expressions = _index_by_logical(catalog.dimensions, catalog.facts, catalog.metrics)
    edges_by_base: dict[str, list[ColumnLineageEdge]] = {}
    for logical_table, name, raw_expression in _each_view_column(catalog):
        for base_logical, base_column in _resolve_physical(logical_expressions, logical_table, raw_expression):
            base_fqn = base_table_fqns_by_logical.get(base_logical.lower())
            if not base_fqn:
                continue
            edges_by_base.setdefault(base_fqn, []).append(ColumnLineageEdge(from_column=base_column, to_column=name))
    return [BaseTableEdge(base_table_fqn=fqn, columns=edges) for fqn, edges in edges_by_base.items()]


def to_view_lineage_request(view_fqn: str, edge: BaseTableEdge) -> OMetaFQNLineageRequest:
    """Build the base-table → semantic-view request for one resolved edge."""
    return OMetaFQNLineageRequest(
        from_entity_fqn=edge.base_table_fqn,
        from_entity_type=_TABLE,
        to_entity_fqn=view_fqn,
        to_entity_type=_TABLE,
        lineage_details=LineageDetails(  # pyright: ignore[reportCallIssue]
            source=LineageSource.ViewLineage,
            columnsLineage=[
                ColumnLineage(  # pyright: ignore[reportCallIssue]
                    fromColumns=[f"{edge.base_table_fqn}.{pair.from_column}"],  # pyright: ignore[reportArgumentType]
                    toColumn=f"{view_fqn}.{pair.to_column}",  # pyright: ignore[reportArgumentType]
                )
                for pair in edge.columns
            ]
            or None,
        ),
    )


def to_metric_lineage_request(view_fqn: str, metric_name: str) -> OMetaFQNLineageRequest:
    """Build the semantic-view → Metric request. Metric FQN is its name."""
    return OMetaFQNLineageRequest(
        from_entity_fqn=view_fqn,
        from_entity_type=_TABLE,
        to_entity_fqn=metric_name,
        to_entity_type=_METRIC,
        lineage_details=LineageDetails(source=LineageSource.ViewLineage),  # pyright: ignore[reportCallIssue]
    )


def _each_view_column(catalog: SemanticViewCatalog) -> Iterable[tuple[str, str, str]]:
    for row in (*catalog.dimensions, *catalog.facts, *catalog.metrics):
        logical_table = row[_ROW_TABLE_IDX] or ""
        name = row[_ROW_NAME_IDX] or ""
        expression = row[_ROW_EXPR_IDX] or ""
        if name and expression:
            yield logical_table, name, expression


def _index_by_logical(*row_groups: list[tuple]) -> dict[str, dict[str, str]]:
    """Map ``{logical_table_lower: {name_lower: expression}}`` for follow-through."""
    index: dict[str, dict[str, str]] = {}
    for group in row_groups:
        for row in group:
            logical_table = (row[_ROW_TABLE_IDX] or "").lower()
            name = (row[_ROW_NAME_IDX] or "").lower()
            expression = row[_ROW_EXPR_IDX] or ""
            if not (logical_table and name and expression):
                continue
            index.setdefault(logical_table, {})[name] = expression
    return index


def _resolve_physical(
    logical_expressions: dict[str, dict[str, str]],
    starting_table: str,
    expression: str,
    depth: int = 0,
) -> Iterable[tuple[str, str]]:
    """Walk expression tokens; yield ``(logical_base_table, base_column)`` pairs.

    A token like ``customers.c_region`` — if ``customers`` is a physical
    logical table (no intra-view expression defined), we yield it directly.
    If ``customers.some_intermediate`` resolves to another expression inside
    the view (e.g. a fact referencing another fact), recurse up to
    ``_MAX_INDIRECTION_DEPTH`` to reach the physical columns."""
    if depth >= _MAX_INDIRECTION_DEPTH:
        return
    for match in _EXPRESSION_TOKEN.finditer(expression):
        table_token, column_token = match.group(1), match.group(2)
        table_key = table_token.lower()
        column_key = column_token.lower()
        inner_expression = logical_expressions.get(table_key, {}).get(column_key)
        if inner_expression:
            yield from _resolve_physical(
                logical_expressions,
                table_token,
                inner_expression,
                depth=depth + 1,
            )
            continue
        yield table_token, column_token
    _ = starting_table
