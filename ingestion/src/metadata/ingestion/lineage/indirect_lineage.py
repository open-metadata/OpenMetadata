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
SQL indirect lineage classifier using bundled sqlglot AST and scope analysis.

Classifies each referenced source table as DIRECT (contributes values to the
output projection, including through CTE chains, derived tables, set operations,
and SELECT *) vs. INDIRECT (referenced exclusively in non-projection clauses
such as JOIN ON/USING, WHERE/EXISTS/IN/SEMI/ANTI, GROUP BY/HAVING, ORDER BY,
QUALIFY, or non-projected WINDOW definitions).

Conservative accuracy rule: any parse error, unsupported construct, timeout,
complexity cap, or unresolved multi-table bare SELECT * / unqualified projection
column falls back conservatively to DIRECT / None so real DIRECT dependencies
are never mislabelled as INDIRECT.
"""

from __future__ import annotations

import functools
import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import sqlglot
from collate_sqllineage.core.parser.sqlglot.analyzer import (
    DIALECT_MAP,
    DIALECT_OVERRIDES,
)
from sqlglot import exp
from sqlglot.optimizer.scope import Scope, ScopeType, build_scope

from metadata.generated.schema.type.entityLineage import DependencyType
from metadata.ingestion.lineage.models import Dialect
from metadata.utils.logger import ingestion_logger
from metadata.utils.timeout import timeout

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping

    from sqlglot.dialects.dialect import DialectType

logger = ingestion_logger()

SUBTYPE_JOIN = "JOIN"
SUBTYPE_FILTER = "FILTER"
SUBTYPE_GROUP_BY = "GROUP_BY"
SUBTYPE_SORT = "SORT"
SUBTYPE_WINDOW = "WINDOW"
SUBTYPE_CONDITIONAL = "CONDITIONAL"

DEFAULT_SCHEMA_PLACEHOLDER = "<default>"
DEFAULT_ANALYSIS_TIMEOUT_SECONDS = 10
MAX_QUERY_LENGTH = 200_000
MAX_AST_NODES = 50_000
MAX_SCOPES = 500
INDIRECT_LINEAGE_CACHE_SIZE = 512

_QUOTE_CHARS = '"`[]'
_SPLIT_TABLE_PART_RE = re.compile(r'("[^"]*"|`[^`]*`|\[[^\]]*\]|[^.]+)')


def _resolve_sqlglot_dialect(dialect: Dialect | str | None) -> DialectType:
    if dialect is None:
        return None
    raw = dialect.value if isinstance(dialect, Dialect) else str(dialect)
    if not raw:
        return None
    mapped = DIALECT_MAP.get(raw, raw)
    return DIALECT_OVERRIDES.get(mapped, mapped)


def _strip_identifier_quotes(part: str) -> str:
    stripped = part.strip()
    if len(stripped) >= 2 and (
        (stripped[0] == '"' and stripped[-1] == '"')
        or (stripped[0] == "`" and stripped[-1] == "`")
        or (stripped[0] == "[" and stripped[-1] == "]")
    ):
        return stripped[1:-1]
    return stripped.strip(_QUOTE_CHARS)


def normalize_table_parts(table_name: str | None) -> tuple[str, ...]:
    """
    Split a raw table reference (including `<default>.tbl`, `db.schema.tbl`, or
    quoted dotted segments like `"dbo.reporting".orders`) into lowercase unquoted
    identifier parts.
    """
    if not table_name:
        return ()
    cleaned = table_name.strip()
    if not cleaned:
        return ()
    raw_parts = _SPLIT_TABLE_PART_RE.findall(cleaned)
    parts = tuple(unquoted.lower() for segment in raw_parts if (unquoted := _strip_identifier_quotes(segment)))
    if parts and parts[0] == DEFAULT_SCHEMA_PLACEHOLDER:
        parts = parts[1:]
    return parts


def _format_raw_table_name(parts: Iterable[str]) -> str:
    formatted = [f'"{part}"' if "." in part else part for part in parts if part]
    return ".".join(formatted)


def _extract_table_info(table: exp.Table) -> tuple[tuple[str, ...], str] | None:
    """Return `(normalized_parts, raw_name)` for a real table reference, or None for non-tables."""
    if isinstance(table.this, exp.Func):
        return None
    raw_parts = [part for part in (table.catalog, table.db, table.name) if part]
    if not raw_parts:
        return None
    # Skip Snowflake stage references (@stage) and placeholder names
    if raw_parts[-1].startswith("@"):
        return None
    norm_parts = tuple(part.lower() for part in raw_parts)
    return norm_parts, _format_raw_table_name(raw_parts)


@dataclass(frozen=True)
class IndirectColumnRef:
    """A single column reference from a non-projection SQL clause."""

    table_name: str
    column_name: str
    subtype: str


@dataclass(frozen=True)
class IndirectLineageResult:
    """
    Classification of referenced source tables and their indirect column references
    for a parsed SQL query (and optionally per target table for multi-statement scripts).
    """

    table_dependencies: Mapping[tuple[str, ...], DependencyType] = field(default_factory=dict)
    indirect_columns: Mapping[tuple[str, ...], tuple[IndirectColumnRef, ...]] = field(default_factory=dict)
    raw_table_names: Mapping[tuple[str, ...], str] = field(default_factory=dict)
    target_results: Mapping[tuple[str, ...], IndirectLineageResult] = field(default_factory=dict)
    conservative_fallback: bool = False

    def for_target(self, target_table: str | None) -> IndirectLineageResult:
        """Select the per-target statement result when available, else return self."""
        if not target_table or not self.target_results:
            return self
        target_parts = normalize_table_parts(target_table)
        matched = _match_keys(self.target_results, target_parts)
        if len(matched) == 1:
            return self.target_results[matched[0]]
        return self

    def classify_table(self, table_name: str, *, target_table: str | None = None) -> DependencyType | None:
        """
        Return `DependencyType.DIRECT`, `DependencyType.INDIRECT`, or `None` if unknown /
        conservative fallback.
        """
        return self.classify_table_parts(normalize_table_parts(table_name), target_table=target_table)

    def classify_table_parts(
        self,
        parts: tuple[str, ...],
        *,
        target_table: str | None = None,
    ) -> DependencyType | None:
        scoped = self.for_target(target_table)
        if scoped.conservative_fallback or not parts or not scoped.table_dependencies:
            return None
        matched_keys = _match_keys(scoped.table_dependencies, parts)
        if not matched_keys:
            return None
        dep_types = {scoped.table_dependencies[key] for key in matched_keys}
        # Conservative rule: if multiple candidate tables match and any is DIRECT, return DIRECT.
        if DependencyType.DIRECT in dep_types:
            return DependencyType.DIRECT
        return DependencyType.INDIRECT

    def get_indirect_columns(
        self,
        table_name: str,
        *,
        target_table: str | None = None,
    ) -> tuple[IndirectColumnRef, ...]:
        return self.get_indirect_columns_for_parts(normalize_table_parts(table_name), target_table=target_table)

    def get_indirect_columns_for_parts(
        self,
        parts: tuple[str, ...],
        *,
        target_table: str | None = None,
    ) -> tuple[IndirectColumnRef, ...]:
        scoped = self.for_target(target_table)
        if scoped.conservative_fallback or not parts or not scoped.indirect_columns:
            return ()
        matched_keys = _match_keys(scoped.indirect_columns, parts)
        if len(matched_keys) != 1:
            return ()
        return scoped.indirect_columns[matched_keys[0]]

    def indirect_tables(self, *, target_table: str | None = None) -> tuple[str, ...]:
        """Return raw table names classified as INDIRECT."""
        scoped = self.for_target(target_table)
        if scoped.conservative_fallback:
            return ()
        return tuple(
            scoped.raw_table_names[key]
            for key, dep_type in scoped.table_dependencies.items()
            if dep_type == DependencyType.INDIRECT and key in scoped.raw_table_names
        )


EMPTY_INDIRECT_LINEAGE = IndirectLineageResult()
CONSERVATIVE_FALLBACK_RESULT = IndirectLineageResult(conservative_fallback=True)


def _match_keys(
    mapping: Mapping[tuple[str, ...], object],
    query_parts: tuple[str, ...],
) -> list[tuple[str, ...]]:
    """
    Match `query_parts` against normalized table keys by exact match first, then
    longest compatible suffix overlap (e.g. `('db', 's', 't')` matches `('s', 't')`
    or `('t',)`, but never `('db2', 's', 't')`).
    """
    if not query_parts:
        return []
    if query_parts in mapping:
        return [query_parts]
    best_overlap = 0
    matches: list[tuple[str, ...]] = []
    for key in mapping:
        overlap = min(len(query_parts), len(key))
        if overlap == 0:
            continue
        if query_parts[-overlap:] == key[-overlap:]:
            if overlap > best_overlap:
                best_overlap = overlap
                matches = [key]
            elif overlap == best_overlap:
                matches.append(key)
    return matches


def _is_star_projection(projection: exp.Expression) -> bool:
    return isinstance(projection, exp.Star) or (
        isinstance(projection, exp.Column) and isinstance(projection.this, exp.Star)
    )


def _select_output_names(scope: Scope) -> tuple[list[str | None], bool]:
    """
    Return `(output_names, has_star)` for a Select or SetOperation scope.
    `output_names` contains lowercase output aliases/names in positional order (None if unnamed).
    """
    if scope.union_scopes:
        return _select_output_names(scope.union_scopes[0])
    if isinstance(scope.expression, exp.Subquery) and scope.derived_table_scopes:
        return _select_output_names(scope.derived_table_scopes[0])
    if not isinstance(scope.expression, exp.Select):
        return [], True
    names: list[str | None] = []
    has_star = False
    for proj in scope.expression.expressions:
        if _is_star_projection(proj):
            has_star = True
            names.append(None)
        else:
            alias_or_name = proj.alias_or_name
            names.append(alias_or_name.lower() if alias_or_name else None)
    return names, has_star


def _select_explicit_aliases(select: exp.Select) -> set[str]:
    """Aliases explicitly introduced by `AS alias` in a SELECT list."""
    aliases: set[str] = set()
    for proj in select.expressions:
        if isinstance(proj, exp.Alias) and proj.alias:
            inner = proj.this
            # If `SELECT u.id AS id`, `id` is still a real column name, not only a new alias.
            if not (isinstance(inner, exp.Column) and inner.name.lower() == proj.alias.lower()):
                aliases.add(proj.alias.lower())
    return aliases


def _collect_direct_window_names(select: exp.Select, projections: Iterable[exp.Expression]) -> set[str]:
    """Collect named WINDOW clauses referenced by any DIRECT projection (including chained window refs)."""
    referenced: set[str] = set()
    for proj in projections:
        for win in proj.find_all(exp.Window):
            if win.alias:
                referenced.add(win.alias.lower())

    named_windows: dict[str, exp.Window] = {}
    for win in select.args.get("windows") or []:
        if isinstance(win, exp.Window) and isinstance(win.this, exp.Identifier) and win.this.name:
            named_windows[win.this.name.lower()] = win

    changed = True
    while changed:
        changed = False
        for name in list(referenced):
            win = named_windows.get(name)
            if win is not None and win.alias and win.alias.lower() not in referenced:
                referenced.add(win.alias.lower())
                changed = True
    return referenced


def _iter_non_subquery_nodes(root: exp.Expression) -> Iterable[exp.Expression]:
    """
    Walk `root` yielding expressions without descending into nested query scopes
    (`exp.Select`, `exp.SetOperation`, `exp.Subquery`). Nested query nodes themselves
    are yielded so callers can dispatch them to their corresponding child `Scope`.
    """
    stack: list[exp.Expression] = [root]
    while stack:
        node = stack.pop()
        yield node
        if node is not root and isinstance(node, (exp.Select, exp.SetOperation, exp.Subquery)):
            continue
        stack.extend(reversed(list(node.iter_expressions())))


def _match_source_by_qualifier(
    qualifier: str,
    sources: Mapping[str, tuple[exp.Expression, exp.Table | Scope]],
) -> tuple[exp.Expression, exp.Table | Scope] | None:
    lowered = qualifier.lower()
    if lowered in sources:
        return sources[lowered]
    for alias, entry in sources.items():
        if alias.lower() == lowered:
            return entry
    matches = [
        entry for entry in sources.values() if isinstance(entry[1], exp.Table) and entry[1].name.lower() == lowered
    ]
    return matches[0] if len(matches) == 1 else None


def _match_column_source_in_scope(
    col: exp.Column,
    sources: Mapping[str, tuple[exp.Expression, exp.Table | Scope]],
) -> tuple[exp.Expression, exp.Table | Scope] | None:
    """Resolve a qualified column (e.g. `u.id` or `schema.users.id`) against `sources`."""
    parts = [part.name.lower() for part in col.parts[:-1] if part.name]
    if not parts:
        return None
    if len(parts) == 1:
        return _match_source_by_qualifier(parts[0], sources)
    target_tuple = tuple(parts)
    matches = []
    for entry in sources.values():
        _, source = entry
        if isinstance(source, exp.Table):
            info = _extract_table_info(source)
            if info is not None:
                norm_parts, _ = info
                overlap = min(len(norm_parts), len(target_tuple))
                if overlap > 0 and norm_parts[-overlap:] == target_tuple[-overlap:]:
                    matches.append(entry)
    if len(matches) == 1:
        return matches[0]
    return _match_source_by_qualifier(parts[-1], sources)


class _ScopeDependencyAnalyzer:
    """Top-down demand-driven scope analyzer for a single SQL query."""

    def __init__(self, root: Scope) -> None:
        self.root = root
        self.all_base_tables: dict[tuple[str, ...], str] = {}
        self.direct_tables: set[tuple[str, ...]] = set()
        self._indirect_col_map: dict[tuple[str, ...], list[IndirectColumnRef]] = {}
        self._indirect_col_seen: set[tuple[tuple[str, ...], str, str]] = set()

        self._visited_direct_all: set[int] = set()
        self._visited_direct_cols: dict[int, set[str]] = {}
        self._visited_indirect_all: dict[int, set[str]] = {}
        self._visited_indirect_cols: dict[int, dict[str, set[str]]] = {}
        self._visited_internal_clauses: set[int] = set()

    def analyze(self) -> IndirectLineageResult:
        self._visit_scope(self.root, all_direct=True)
        table_dependencies: dict[tuple[str, ...], DependencyType] = {}
        for key in self.all_base_tables:
            table_dependencies[key] = DependencyType.DIRECT if key in self.direct_tables else DependencyType.INDIRECT
        indirect_columns = {key: tuple(refs) for key, refs in self._indirect_col_map.items() if refs}
        return IndirectLineageResult(
            table_dependencies=table_dependencies,
            indirect_columns=indirect_columns,
            raw_table_names=dict(self.all_base_tables),
        )

    def _register_table(self, table: exp.Table) -> tuple[tuple[str, ...], str] | None:
        info = _extract_table_info(table)
        if info is None:
            return None
        norm_parts, raw_name = info
        self.all_base_tables.setdefault(norm_parts, raw_name)
        return norm_parts, raw_name

    def _mark_table_direct(self, table: exp.Table) -> None:
        info = self._register_table(table)
        if info is not None:
            self.direct_tables.add(info[0])

    def _record_indirect_column(self, table: exp.Table, column_name: str, subtype: str) -> None:
        if not column_name or column_name == "*":
            return
        info = self._register_table(table)
        if info is None:
            return
        norm_parts, raw_name = info
        dedup_key = (norm_parts, column_name.lower(), subtype)
        if dedup_key in self._indirect_col_seen:
            return
        self._indirect_col_seen.add(dedup_key)
        self._indirect_col_map.setdefault(norm_parts, []).append(
            IndirectColumnRef(table_name=raw_name, column_name=column_name, subtype=subtype)
        )

    def _scope_sources(
        self,
        scope: Scope,
    ) -> tuple[
        dict[str, tuple[exp.Expression, exp.Table | Scope]],
        dict[str, tuple[exp.Expression, exp.Table | Scope]],
    ]:
        """
        Return `(selected_sources, all_sources)` for a Select scope.
        `all_sources` additionally includes `LEFT SEMI` / `LEFT ANTI` join targets that
        sqlglot's `selected_sources` omits.
        """
        selected: dict[str, tuple[exp.Expression, exp.Table | Scope]] = {}
        for alias, entry in scope.selected_sources.items():
            selected[alias.lower()] = entry
            if isinstance(entry[1], exp.Table):
                self._register_table(entry[1])

        all_sources = dict(selected)
        if isinstance(scope.expression, exp.Select):
            derived_by_expr = {id(child.expression): child for child in scope.derived_table_scopes}
            subquery_by_expr = {id(child.expression): child for child in scope.subquery_scopes}
            for join in scope.expression.args.get("joins") or []:
                join_target = join.this
                if join_target is None:
                    continue
                alias = (join_target.alias_or_name or "").lower()
                if alias and alias in all_sources:
                    continue
                if isinstance(join_target, exp.Table):
                    # Check if join_target is a CTE in scope.sources
                    cte_source = scope.sources.get(join_target.name) or scope.sources.get(join_target.name.lower())
                    if isinstance(cte_source, Scope) and not join_target.db and not join_target.catalog:
                        key = alias or join_target.name.lower()
                        all_sources[key] = (join_target, cte_source)
                    else:
                        info = self._register_table(join_target)
                        if info is not None:
                            key = alias or info[0][-1]
                            all_sources[key] = (join_target, join_target)
                elif isinstance(join_target, exp.Subquery):
                    inner = join_target.this
                    child_scope = (
                        derived_by_expr.get(id(inner))
                        or subquery_by_expr.get(id(inner))
                        or derived_by_expr.get(id(join_target))
                        or subquery_by_expr.get(id(join_target))
                    )
                    if child_scope is not None:
                        key = alias or f"__semi_{id(join_target)}"
                        all_sources[key] = (join_target, child_scope)
        return selected, all_sources

    def _visit_scope(
        self,
        scope: Scope,
        *,
        all_direct: bool = False,
        direct_cols: set[str] | None = None,
        indirect_subtype: str | None = None,
        indirect_cols: Mapping[str, set[str]] | None = None,
    ) -> None:
        scope_id = id(scope)

        # Deduplicate demand so shared / recursive CTEs cannot loop or blow up exponentially.
        new_all_direct = all_direct and scope_id not in self._visited_direct_all
        if new_all_direct:
            self._visited_direct_all.add(scope_id)

        new_direct_cols: set[str] = set()
        if not all_direct and scope_id not in self._visited_direct_all and direct_cols:
            seen_dcols = self._visited_direct_cols.setdefault(scope_id, set())
            new_direct_cols = {c.lower() for c in direct_cols if c} - seen_dcols
            seen_dcols.update(new_direct_cols)

        new_indirect_subtypes: set[str] = set()
        if indirect_subtype:
            seen_isub = self._visited_indirect_all.setdefault(scope_id, set())
            if indirect_subtype not in seen_isub:
                seen_isub.add(indirect_subtype)
                new_indirect_subtypes.add(indirect_subtype)

        new_indirect_cols: dict[str, set[str]] = {}
        if indirect_cols:
            seen_icols = self._visited_indirect_cols.setdefault(scope_id, {})
            for col_name, subtypes in indirect_cols.items():
                lower_col = col_name.lower()
                existing = seen_icols.setdefault(lower_col, set())
                diff = set(subtypes) - existing
                if diff:
                    existing.update(diff)
                    new_indirect_cols[lower_col] = diff

        run_internal = scope_id not in self._visited_internal_clauses
        if (
            not new_all_direct
            and not new_direct_cols
            and not new_indirect_subtypes
            and not new_indirect_cols
            and not run_internal
        ):
            return

        if scope.scope_type == ScopeType.UDTF:
            self._visit_udtf_scope(
                scope,
                is_direct=new_all_direct or bool(new_direct_cols),
                indirect_subtypes=new_indirect_subtypes | {sub for subs in new_indirect_cols.values() for sub in subs},
            )
            self._visited_internal_clauses.add(scope_id)
            return

        if scope.union_scopes:
            self._visit_union_scope(
                scope,
                all_direct=new_all_direct,
                direct_cols=new_direct_cols,
                indirect_subtypes=new_indirect_subtypes,
                indirect_cols=new_indirect_cols,
                run_internal=run_internal,
            )
            return

        if isinstance(scope.expression, exp.Subquery) and scope.derived_table_scopes:
            self._visited_internal_clauses.add(scope_id)
            for sub in new_indirect_subtypes or {None}:
                self._visit_scope(
                    scope.derived_table_scopes[0],
                    all_direct=new_all_direct,
                    direct_cols=new_direct_cols or None,
                    indirect_subtype=sub,
                    indirect_cols=new_indirect_cols or None,
                )
            return

        if not isinstance(scope.expression, exp.Select):
            self._visited_internal_clauses.add(scope_id)
            return

        self._visit_select_scope(
            scope,
            all_direct=new_all_direct,
            direct_cols=new_direct_cols,
            indirect_subtypes=new_indirect_subtypes,
            indirect_cols=new_indirect_cols,
            run_internal=run_internal,
        )

    def _visit_udtf_scope(
        self,
        scope: Scope,
        *,
        is_direct: bool,
        indirect_subtypes: set[str],
    ) -> None:
        parent = scope.parent
        if parent is None:
            return
        _, parent_sources = self._scope_sources(parent)
        columns = list(scope.expression.find_all(exp.Column))
        if is_direct:
            for col in columns:
                self._resolve_column(col, parent, parent_sources, is_direct=True, subtype=None)
        for subtype in indirect_subtypes:
            for col in columns:
                self._resolve_column(col, parent, parent_sources, is_direct=False, subtype=subtype)

    def _propagate_union_branch(
        self,
        branch: Scope,
        b_names: list[str | None],
        indices: dict[str, int],
        *,
        as_direct: bool,
        subtype_map: dict[str, set[str]] | None,
    ) -> None:
        if as_direct:
            mapped_direct = {name for idx in indices.values() if (name := b_names[idx]) is not None}
            if len(mapped_direct) == len(indices):
                self._visit_scope(branch, direct_cols=mapped_direct)
            else:
                self._visit_scope(branch, all_direct=True)
            return
        if not subtype_map:
            return
        mapped_indirect: dict[str, set[str]] = {}
        fallback_subs: set[str] = set()
        for col, idx in indices.items():
            b_col = b_names[idx]
            if b_col:
                mapped_indirect.setdefault(b_col, set()).update(subtype_map[col])
            else:
                fallback_subs.update(subtype_map[col])
        if mapped_indirect:
            self._visit_scope(branch, indirect_cols=mapped_indirect)
        for sub in fallback_subs:
            self._visit_scope(branch, indirect_subtype=sub)

    def _propagate_union_positional(
        self,
        branches: list[Scope],
        branch_outputs: list[tuple[list[str | None], bool]],
        col_names: set[str],
        *,
        as_direct: bool,
        subtype_map: dict[str, set[str]] | None,
    ) -> None:
        left_names, left_has_star = branch_outputs[0]
        can_map = (
            not left_has_star
            and all(not has_star and len(names) == len(left_names) for names, has_star in branch_outputs)
            and all(col in left_names for col in col_names)
        )
        if not can_map:
            for branch in branches:
                if as_direct:
                    self._visit_scope(branch, all_direct=True)
                elif subtype_map:
                    for sub in {s for subs in subtype_map.values() for s in subs}:
                        self._visit_scope(branch, indirect_subtype=sub)
            return

        indices = {col: left_names.index(col) for col in col_names}
        for branch, (b_names, _) in zip(branches, branch_outputs, strict=True):
            self._propagate_union_branch(branch, b_names, indices, as_direct=as_direct, subtype_map=subtype_map)

    def _visit_union_scope(
        self,
        scope: Scope,
        *,
        all_direct: bool,
        direct_cols: set[str],
        indirect_subtypes: set[str],
        indirect_cols: dict[str, set[str]],
        run_internal: bool,
    ) -> None:
        self._visited_internal_clauses.add(id(scope))
        branches = list(scope.union_scopes)
        if not branches:
            return
        branch_outputs = [_select_output_names(branch) for branch in branches]

        if all_direct:
            for branch in branches:
                self._visit_scope(branch, all_direct=True)
        elif direct_cols:
            self._propagate_union_positional(branches, branch_outputs, direct_cols, as_direct=True, subtype_map=None)

        for sub in indirect_subtypes:
            for branch in branches:
                self._visit_scope(branch, indirect_subtype=sub)

        if indirect_cols:
            self._propagate_union_positional(
                branches, branch_outputs, set(indirect_cols), as_direct=False, subtype_map=indirect_cols
            )

        if run_internal and isinstance(scope.expression, exp.SetOperation):
            order_clause = scope.expression.args.get("order")
            if order_clause is not None:
                order_cols = {col.name.lower() for col in order_clause.find_all(exp.Column) if col.name}
                if order_cols:
                    self._propagate_union_positional(
                        branches,
                        branch_outputs,
                        order_cols,
                        as_direct=False,
                        subtype_map={col: {SUBTYPE_SORT} for col in order_cols},
                    )

    @staticmethod
    def _collect_select_projections(
        select: exp.Select,
        *,
        all_direct: bool,
        direct_cols: set[str],
        indirect_subtypes: set[str],
        indirect_cols: dict[str, set[str]],
    ) -> tuple[list[exp.Expression], list[tuple[exp.Expression, str]]]:
        direct_projections: list[exp.Expression] = []
        if all_direct:
            direct_projections.extend(select.expressions)
        elif direct_cols:
            direct_projections.extend(
                proj
                for proj in select.expressions
                if _is_star_projection(proj) or (proj.alias_or_name and proj.alias_or_name.lower() in direct_cols)
            )

        indirect_projections: list[tuple[exp.Expression, str]] = [
            (proj, subtype) for subtype in indirect_subtypes for proj in select.expressions
        ]
        if indirect_cols:
            for proj in select.expressions:
                if _is_star_projection(proj):
                    indirect_projections.extend(
                        (proj, subtype) for subtypes in indirect_cols.values() for subtype in subtypes
                    )
                else:
                    out_name = proj.alias_or_name.lower() if proj.alias_or_name else None
                    if out_name and out_name in indirect_cols:
                        indirect_projections.extend((proj, subtype) for subtype in indirect_cols[out_name])
        return direct_projections, indirect_projections

    def _visit_select_scope(
        self,
        scope: Scope,
        *,
        all_direct: bool,
        direct_cols: set[str],
        indirect_subtypes: set[str],
        indirect_cols: dict[str, set[str]],
        run_internal: bool,
    ) -> None:
        select = scope.expression
        assert isinstance(select, exp.Select)

        selected_sources, all_sources = self._scope_sources(scope)
        subquery_map = self._build_subquery_scope_map(scope)

        if all_direct or direct_cols:
            for node, source in selected_sources.values():
                if node.args.get("pivots"):
                    self._mark_source_direct(source, all_cols=True)

        direct_projections, indirect_projections = self._collect_select_projections(
            select,
            all_direct=all_direct,
            direct_cols=direct_cols,
            indirect_subtypes=indirect_subtypes,
            indirect_cols=indirect_cols,
        )

        direct_resolved_flags = [
            self._process_expression(proj, scope, selected_sources, subquery_map, is_direct=True, subtype=None)
            for proj in direct_projections
        ]
        direct_resolved_any = any(direct_resolved_flags)

        if direct_projections:
            self._process_direct_windows(select, direct_projections, scope, selected_sources, subquery_map)

        # `SELECT COUNT(*) FROM users` (single-table row count with no column references):
        # mark the FROM source DIRECT so row-count tables are not mislabelled INDIRECT.
        if (
            all_direct
            and not direct_resolved_any
            and len(selected_sources) == 1
            and any(isinstance(node, exp.Count) for proj in direct_projections for node in proj.walk())
        ):
            _, sole_source = next(iter(selected_sources.values()))
            self._mark_source_direct(sole_source, all_cols=True)

        for proj, subtype in indirect_projections:
            self._process_expression(proj, scope, selected_sources, subquery_map, is_direct=False, subtype=subtype)

        for subtype in indirect_subtypes:
            for _, source in all_sources.values():
                if isinstance(source, Scope):
                    self._visit_scope(source, indirect_subtype=subtype)

        if run_internal:
            self._visited_internal_clauses.add(id(scope))
            self._visit_internal_clauses(select, scope, selected_sources, all_sources, subquery_map)

    def _process_direct_windows(
        self,
        select: exp.Select,
        direct_projections: list[exp.Expression],
        scope: Scope,
        selected_sources: dict[str, tuple[exp.Expression, exp.Table | Scope]],
        subquery_map: dict[int, Scope],
    ) -> None:
        direct_window_names = _collect_direct_window_names(select, direct_projections)
        for win in select.args.get("windows") or []:
            if (
                isinstance(win, exp.Window)
                and isinstance(win.this, exp.Identifier)
                and win.this.name.lower() in direct_window_names
            ):
                self._process_expression(win, scope, selected_sources, subquery_map, is_direct=True, subtype=None)

    def _visit_joins(
        self,
        select: exp.Select,
        scope: Scope,
        selected_sources: dict[str, tuple[exp.Expression, exp.Table | Scope]],
        all_sources: dict[str, tuple[exp.Expression, exp.Table | Scope]],
        subquery_map: dict[int, Scope],
    ) -> None:
        for join in select.args.get("joins") or []:
            is_semi_anti = (join.kind or "").upper() in {"SEMI", "ANTI"}
            join_subtype = SUBTYPE_FILTER if is_semi_anti else SUBTYPE_JOIN

            on_clause = join.args.get("on")
            if on_clause is not None:
                self._process_expression(
                    on_clause, scope, all_sources, subquery_map, is_direct=False, subtype=join_subtype
                )

            using_cols = join.args.get("using") or []
            if using_cols:
                self._visit_join_using(join, using_cols, join_subtype, selected_sources, all_sources)

            if join.this is not None:
                joined_alias = (join.this.alias_or_name or "").lower()
                joined_entry = all_sources.get(joined_alias)
                if joined_entry is None and isinstance(join.this, exp.Subquery):
                    joined_entry = all_sources.get(f"__semi_{id(join.this)}")
                if joined_entry is not None and isinstance(joined_entry[1], Scope):
                    self._visit_scope(joined_entry[1], indirect_subtype=join_subtype)

    def _visit_join_using(
        self,
        join: exp.Join,
        using_cols: list[exp.Expression],
        join_subtype: str,
        selected_sources: dict[str, tuple[exp.Expression, exp.Table | Scope]],
        all_sources: dict[str, tuple[exp.Expression, exp.Table | Scope]],
    ) -> None:
        joined_alias = (join.this.alias_or_name or "").lower() if join.this is not None else ""
        joined_entry = all_sources.get(joined_alias)
        for col_ident in using_cols:
            col_name = col_ident.name if isinstance(col_ident, exp.Expression) else str(col_ident)
            if not col_name:
                continue
            if joined_entry is not None:
                self._record_indirect_on_source(joined_entry[1], col_name, join_subtype)
            if len(selected_sources) == 2:
                for alias, (_, src) in selected_sources.items():
                    if alias != joined_alias:
                        self._record_indirect_on_source(src, col_name, join_subtype)

    def _visit_internal_clauses(
        self,
        select: exp.Select,
        scope: Scope,
        selected_sources: dict[str, tuple[exp.Expression, exp.Table | Scope]],
        all_sources: dict[str, tuple[exp.Expression, exp.Table | Scope]],
        subquery_map: dict[int, Scope],
    ) -> None:
        explicit_aliases = _select_explicit_aliases(select)
        all_direct_windows = _collect_direct_window_names(select, select.expressions)
        self._visit_joins(select, scope, selected_sources, all_sources, subquery_map)

        clause_subtypes: tuple[tuple[str, str, set[str] | None], ...] = (
            ("where", SUBTYPE_FILTER, None),
            ("group", SUBTYPE_GROUP_BY, explicit_aliases),
            ("having", SUBTYPE_GROUP_BY, explicit_aliases),
            ("order", SUBTYPE_SORT, explicit_aliases),
            ("qualify", SUBTYPE_WINDOW, explicit_aliases),
        )
        for clause_name, subtype, skip_aliases in clause_subtypes:
            clause = select.args.get(clause_name)
            if clause is not None:
                self._process_expression(
                    clause,
                    scope,
                    selected_sources,
                    subquery_map,
                    is_direct=False,
                    subtype=subtype,
                    skip_unqualified=skip_aliases,
                )

        scope_has_direct = id(scope) in self._visited_direct_all or id(scope) in self._visited_direct_cols
        for win in select.args.get("windows") or []:
            if not isinstance(win, exp.Window):
                continue
            win_name = win.this.name.lower() if isinstance(win.this, exp.Identifier) and win.this.name else ""
            if win_name and win_name in all_direct_windows and scope_has_direct:
                continue
            self._process_expression(
                win,
                scope,
                selected_sources,
                subquery_map,
                is_direct=False,
                subtype=SUBTYPE_WINDOW,
                skip_unqualified=explicit_aliases,
            )

    @staticmethod
    def _build_subquery_scope_map(scope: Scope) -> dict[int, Scope]:
        mapping: dict[int, Scope] = {}
        for child in scope.subquery_scopes:
            mapping[id(child.expression)] = child
            if isinstance(child.expression.parent, exp.Subquery):
                mapping[id(child.expression.parent)] = child
        return mapping

    def _mark_source_direct(self, source: exp.Table | Scope, *, all_cols: bool, col_name: str | None = None) -> None:
        if isinstance(source, exp.Table):
            self._mark_table_direct(source)
        elif isinstance(source, Scope):
            if all_cols or not col_name:
                self._visit_scope(source, all_direct=True)
            else:
                self._visit_scope(source, direct_cols={col_name.lower()})

    def _record_indirect_on_source(self, source: exp.Table | Scope, col_name: str, subtype: str) -> None:
        if isinstance(source, exp.Table):
            self._record_indirect_column(source, col_name, subtype)
        elif isinstance(source, Scope):
            self._visit_scope(source, indirect_cols={col_name.lower(): {subtype}})

    def _handle_subquery_node(
        self,
        node: exp.Expression,
        subquery_map: dict[int, Scope],
        *,
        is_direct: bool,
        subtype: str | None,
    ) -> bool:
        child_scope = subquery_map.get(id(node))
        if child_scope is None and isinstance(node, exp.Subquery) and node.this is not None:
            child_scope = subquery_map.get(id(node.this))
        if child_scope is None:
            return False
        if is_direct:
            self._visit_scope(child_scope, all_direct=True)
        elif subtype:
            self._visit_scope(child_scope, indirect_subtype=subtype)
        return True

    def _handle_star_node(
        self,
        node: exp.Star,
        sources: dict[str, tuple[exp.Expression, exp.Table | Scope]],
        *,
        is_direct: bool,
        subtype: str | None,
    ) -> bool:
        if isinstance(node.parent, (exp.Count, exp.Column)):
            return False
        if is_direct:
            for _, source in sources.values():
                self._mark_source_direct(source, all_cols=True)
        elif subtype:
            for _, source in sources.values():
                if isinstance(source, Scope):
                    self._visit_scope(source, indirect_subtype=subtype)
        return True

    def _handle_qualified_star(
        self,
        node: exp.Column,
        sources: dict[str, tuple[exp.Expression, exp.Table | Scope]],
        *,
        is_direct: bool,
        subtype: str | None,
    ) -> None:
        matched = _match_column_source_in_scope(node, sources)
        if matched is not None:
            if is_direct:
                self._mark_source_direct(matched[1], all_cols=True)
            elif subtype and isinstance(matched[1], Scope):
                self._visit_scope(matched[1], indirect_subtype=subtype)
        elif is_direct:
            for _, source in sources.values():
                self._mark_source_direct(source, all_cols=True)

    def _process_expression(
        self,
        expr: exp.Expression,
        scope: Scope,
        sources: dict[str, tuple[exp.Expression, exp.Table | Scope]],
        subquery_map: dict[int, Scope],
        *,
        is_direct: bool,
        subtype: str | None,
        skip_unqualified: set[str] | None = None,
    ) -> bool:
        """
        Walk `expr` resolving column references, stars, and nested subqueries.
        Returns True if any source was resolved (used to detect bare `COUNT(*)` queries).
        """
        resolved_any = False
        for node in _iter_non_subquery_nodes(expr):
            if node is not expr and isinstance(node, (exp.Select, exp.SetOperation, exp.Subquery)):
                resolved_any = (
                    self._handle_subquery_node(node, subquery_map, is_direct=is_direct, subtype=subtype) or resolved_any
                )
            elif isinstance(node, exp.Star):
                resolved_any = (
                    self._handle_star_node(node, sources, is_direct=is_direct, subtype=subtype) or resolved_any
                )
            elif isinstance(node, exp.Column):
                if isinstance(node.this, exp.Star):
                    self._handle_qualified_star(node, sources, is_direct=is_direct, subtype=subtype)
                    resolved_any = True
                elif self._resolve_column(
                    node,
                    scope,
                    sources,
                    is_direct=is_direct,
                    subtype=subtype,
                    skip_unqualified=skip_unqualified,
                ):
                    resolved_any = True
        return resolved_any

    def _apply_column_demand(
        self,
        source: exp.Table | Scope,
        col_name: str,
        *,
        is_direct: bool,
        subtype: str | None,
    ) -> None:
        if is_direct:
            self._mark_source_direct(source, all_cols=False, col_name=col_name)
        elif subtype:
            self._record_indirect_on_source(source, col_name, subtype)

    def _resolve_qualified_column(
        self,
        col: exp.Column,
        scope: Scope,
        sources: dict[str, tuple[exp.Expression, exp.Table | Scope]],
        *,
        is_direct: bool,
        subtype: str | None,
    ) -> bool:
        col_name = col.name
        matched = _match_column_source_in_scope(col, sources)
        if matched is not None:
            self._apply_column_demand(matched[1], col_name, is_direct=is_direct, subtype=subtype)
            return True

        parent = scope.parent
        while parent is not None:
            _, parent_sources = self._scope_sources(parent)
            parent_matched = _match_column_source_in_scope(col, parent_sources)
            if parent_matched is not None:
                self._apply_column_demand(parent_matched[1], col_name, is_direct=is_direct, subtype=subtype)
                return True
            parent = parent.parent

        if len(sources) == 1:
            _, sole_source = next(iter(sources.values()))
            top_col = col.parts[0].name if col.parts else col_name
            self._apply_column_demand(sole_source, top_col, is_direct=is_direct, subtype=subtype)
            return True

        if is_direct:
            for _, source in sources.values():
                self._mark_source_direct(source, all_cols=True)
            return True
        return False

    def _resolve_unqualified_column(
        self,
        col_name: str,
        sources: dict[str, tuple[exp.Expression, exp.Table | Scope]],
        *,
        is_direct: bool,
        subtype: str | None,
    ) -> bool:
        if len(sources) == 1:
            _, sole_source = next(iter(sources.values()))
            self._apply_column_demand(sole_source, col_name, is_direct=is_direct, subtype=subtype)
            return True

        if len(sources) > 1:
            unique_scope = self._find_unique_scope_owner(col_name.lower(), sources)
            if unique_scope is not None:
                self._apply_column_demand(unique_scope, col_name, is_direct=is_direct, subtype=subtype)
                return True
            if is_direct:
                for _, source in sources.values():
                    self._mark_source_direct(source, all_cols=False, col_name=col_name)
                return True
        return False

    @staticmethod
    def _find_unique_scope_owner(
        lower_col: str,
        sources: dict[str, tuple[exp.Expression, exp.Table | Scope]],
    ) -> Scope | None:
        if not all(isinstance(src, Scope) for _, src in sources.values()):
            return None
        candidate_scopes: list[Scope] = []
        for _, src in sources.values():
            assert isinstance(src, Scope)
            out_names, has_star = _select_output_names(src)
            if has_star:
                return None
            if lower_col in out_names:
                candidate_scopes.append(src)
        return candidate_scopes[0] if len(candidate_scopes) == 1 else None

    def _resolve_column(
        self,
        col: exp.Column,
        scope: Scope,
        sources: dict[str, tuple[exp.Expression, exp.Table | Scope]],
        *,
        is_direct: bool,
        subtype: str | None,
        skip_unqualified: set[str] | None = None,
    ) -> bool:
        col_name = col.name
        if not col_name:
            return False
        if col.table or len(col.parts) > 1:
            return self._resolve_qualified_column(col, scope, sources, is_direct=is_direct, subtype=subtype)
        if skip_unqualified and col_name.lower() in skip_unqualified:
            return False
        return self._resolve_unqualified_column(col_name, sources, is_direct=is_direct, subtype=subtype)


def _merge_has_direct_write(when_list: list[exp.Expression], target_alias: str | None) -> bool:
    for when in when_list:
        then = when.args.get("then") if isinstance(when, exp.When) else None
        if not isinstance(then, (exp.Update, exp.Insert)):
            continue
        if list(then.find_all(exp.Star)):
            return True
        for col in then.find_all(exp.Column):
            qualifier = col.table.lower() if col.table else ""
            if not qualifier or qualifier != target_alias:
                return True
    return False


def _collect_merge_indirect_refs(
    merge: exp.Merge,
    when_list: list[exp.Expression],
    using_alias: str,
    raw_name: str,
) -> list[IndirectColumnRef]:
    refs: list[IndirectColumnRef] = []
    seen: set[tuple[str, str]] = set()
    clauses: list[tuple[exp.Expression | None, str]] = [(merge.args.get("on"), SUBTYPE_JOIN)]
    clauses.extend((when.args.get("condition"), SUBTYPE_FILTER) for when in when_list if isinstance(when, exp.When))
    for clause, subtype in clauses:
        if clause is None:
            continue
        for col in clause.find_all(exp.Column):
            qual = col.table.lower() if col.table else ""
            if qual and qual == using_alias and col.name and (col.name.lower(), subtype) not in seen:
                seen.add((col.name.lower(), subtype))
                refs.append(IndirectColumnRef(raw_name, col.name, subtype))
    return refs


def _analyze_merge(merge: exp.Merge) -> tuple[tuple[str, ...] | None, IndirectLineageResult]:
    """Analyze a MERGE INTO tgt USING src ON ... WHEN ... statement conservatively."""
    target_key: tuple[str, ...] | None = None
    target_alias: str | None = None
    if isinstance(merge.this, exp.Table):
        info = _extract_table_info(merge.this)
        if info is not None:
            target_key = info[0]
            target_alias = (merge.this.alias or merge.this.name).lower()

    using_expr = merge.args.get("using")
    if using_expr is None:
        return target_key, EMPTY_INDIRECT_LINEAGE

    whens = merge.args.get("whens")
    when_list: list[exp.Expression] = (
        list(whens.expressions) if isinstance(whens, exp.Whens) else (list(whens) if isinstance(whens, list) else [])
    )
    has_direct_write = _merge_has_direct_write(when_list, target_alias)

    if isinstance(using_expr, exp.Table):
        info = _extract_table_info(using_expr)
        if info is None:
            return target_key, EMPTY_INDIRECT_LINEAGE
        norm_parts, raw_name = info
        using_alias = (using_expr.alias or using_expr.name).lower()
        dep_type = DependencyType.DIRECT if has_direct_write else DependencyType.INDIRECT
        indirect_refs = _collect_merge_indirect_refs(merge, when_list, using_alias, raw_name)
        return target_key, IndirectLineageResult(
            table_dependencies={norm_parts: dep_type},
            indirect_columns={norm_parts: tuple(indirect_refs)} if indirect_refs else {},
            raw_table_names={norm_parts: raw_name},
        )

    if isinstance(using_expr, exp.Subquery) and isinstance(using_expr.this, exp.Query):
        root = build_scope(using_expr.this)
        if root is None:
            return target_key, CONSERVATIVE_FALLBACK_RESULT
        sub_result = _ScopeDependencyAnalyzer(root).analyze()
        if has_direct_write:
            return target_key, sub_result
        return target_key, IndirectLineageResult(
            table_dependencies=dict.fromkeys(sub_result.table_dependencies, DependencyType.INDIRECT),
            indirect_columns=sub_result.indirect_columns,
            raw_table_names=sub_result.raw_table_names,
        )

    return target_key, CONSERVATIVE_FALLBACK_RESULT


def _analyze_statement(stmt: exp.Expression) -> tuple[tuple[str, ...] | None, IndirectLineageResult]:
    if isinstance(stmt, exp.Command):
        return None, CONSERVATIVE_FALLBACK_RESULT

    if isinstance(stmt, exp.Merge):
        return _analyze_merge(stmt)

    target_key: tuple[str, ...] | None = None
    body: exp.Expression | None = None

    if isinstance(stmt, (exp.Create, exp.Insert)):
        target_node = stmt.this.this if isinstance(stmt.this, exp.Schema) else stmt.this
        if isinstance(target_node, exp.Table):
            info = _extract_table_info(target_node)
            if info is not None:
                target_key = info[0]
        body = stmt.expression
        if not isinstance(body, exp.Query):
            return target_key, EMPTY_INDIRECT_LINEAGE
    elif isinstance(stmt, exp.Query):
        body = stmt
    else:
        return None, EMPTY_INDIRECT_LINEAGE

    root = build_scope(body)
    if root is None:
        return target_key, CONSERVATIVE_FALLBACK_RESULT

    if any(scope_count > MAX_SCOPES for scope_count, _ in enumerate(root.traverse(), start=1)):
        return target_key, CONSERVATIVE_FALLBACK_RESULT

    return target_key, _ScopeDependencyAnalyzer(root).analyze()


def _merge_statement_results(
    statement_results: list[tuple[tuple[str, ...] | None, IndirectLineageResult]],
) -> IndirectLineageResult:
    if not statement_results:
        return EMPTY_INDIRECT_LINEAGE
    if len(statement_results) == 1:
        target_key, single = statement_results[0]
        if target_key is None or single.conservative_fallback:
            return single
        return IndirectLineageResult(
            table_dependencies=single.table_dependencies,
            indirect_columns=single.indirect_columns,
            raw_table_names=single.raw_table_names,
            target_results={target_key: single},
            conservative_fallback=single.conservative_fallback,
        )

    merged_deps: dict[tuple[str, ...], DependencyType] = {}
    merged_cols: dict[tuple[str, ...], list[IndirectColumnRef]] = {}
    merged_col_seen: set[tuple[tuple[str, ...], str, str]] = set()
    merged_raw: dict[tuple[str, ...], str] = {}
    target_results: dict[tuple[str, ...], IndirectLineageResult] = {}
    any_fallback = False

    for target_key, res in statement_results:
        if res.conservative_fallback:
            any_fallback = True
            if target_key is not None:
                target_results[target_key] = res
            continue
        if target_key is not None:
            if target_key in target_results:
                target_results[target_key] = _merge_statement_results([(None, target_results[target_key]), (None, res)])
            else:
                target_results[target_key] = res

        for key, dep_type in res.table_dependencies.items():
            # Conservative merge: DIRECT beats INDIRECT across statements.
            if merged_deps.get(key) != DependencyType.DIRECT:
                merged_deps[key] = dep_type
        for key, raw in res.raw_table_names.items():
            merged_raw.setdefault(key, raw)
        for key, refs in res.indirect_columns.items():
            for ref in refs:
                dedup = (key, ref.column_name.lower(), ref.subtype)
                if dedup not in merged_col_seen:
                    merged_col_seen.add(dedup)
                    merged_cols.setdefault(key, []).append(ref)

    return IndirectLineageResult(
        table_dependencies=merged_deps,
        indirect_columns={k: tuple(v) for k, v in merged_cols.items()},
        raw_table_names=merged_raw,
        target_results=target_results,
        conservative_fallback=any_fallback and not merged_deps,
    )


@functools.lru_cache(maxsize=INDIRECT_LINEAGE_CACHE_SIZE)
def _analyze_cached(query: str, sqlglot_dialect: DialectType) -> IndirectLineageResult:
    try:
        statements = sqlglot.parse(
            query,
            dialect=sqlglot_dialect,
            error_level=sqlglot.ErrorLevel.RAISE,
        )
    except Exception as exc:
        logger.debug("Indirect lineage SQL parse fallback (dialect=%s): %s", sqlglot_dialect, exc)
        return CONSERVATIVE_FALLBACK_RESULT

    parsed = [stmt for stmt in statements if stmt is not None]
    if not parsed:
        return EMPTY_INDIRECT_LINEAGE

    total_nodes = 0
    for stmt in parsed:
        for _ in stmt.walk():
            total_nodes += 1
            if total_nodes > MAX_AST_NODES:
                logger.debug("Indirect lineage AST node cap (%d) exceeded; using conservative fallback", MAX_AST_NODES)
                return CONSERVATIVE_FALLBACK_RESULT

    results: list[tuple[tuple[str, ...] | None, IndirectLineageResult]] = []
    for stmt in parsed:
        try:
            results.append(_analyze_statement(stmt))
        except Exception as exc:
            logger.debug("Indirect lineage statement analysis fallback: %s", exc)
            results.append((None, CONSERVATIVE_FALLBACK_RESULT))

    return _merge_statement_results(results)


def analyze_indirect_lineage(
    query: str | None,
    dialect: Dialect | str | None = Dialect.ANSI,
    timeout_seconds: int = DEFAULT_ANALYSIS_TIMEOUT_SECONDS,
) -> IndirectLineageResult:
    """
    Analyze SQL to classify each source table as DIRECT vs INDIRECT and extract
    per-table indirect column references.

    Always bounded by query length, AST node count, scope count, LRU cache size,
    and execution timeout. Never raises on malformed or unsupported SQL — returns
    a conservative fallback result instead.
    """
    if not query or not query.strip():
        return EMPTY_INDIRECT_LINEAGE
    stripped = query.strip()
    if len(stripped) > MAX_QUERY_LENGTH:
        logger.debug("Indirect lineage skipped: query length %d exceeds cap %d", len(stripped), MAX_QUERY_LENGTH)
        return CONSERVATIVE_FALLBACK_RESULT

    sqlglot_dialect = _resolve_sqlglot_dialect(dialect)
    effective_timeout = max(1, min(int(timeout_seconds), DEFAULT_ANALYSIS_TIMEOUT_SECONDS))
    try:
        return timeout(seconds=effective_timeout)(_analyze_cached)(stripped, sqlglot_dialect)
    except TimeoutError:
        logger.debug("Indirect lineage analysis timed out after %ds; using conservative fallback", effective_timeout)
        return CONSERVATIVE_FALLBACK_RESULT
    except Exception as exc:
        logger.debug("Indirect lineage analysis failed unexpectedly: %s", exc)
        return CONSERVATIVE_FALLBACK_RESULT
