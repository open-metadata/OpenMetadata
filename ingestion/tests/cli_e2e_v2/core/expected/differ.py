#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Structural differ — walks an Expected* tree, fetches actual OM state per-level,
collects path-qualified diffs, raises StructuralMismatch when anything doesn't match.

Public surface: `assert_service_matches(expected, om, mode=SUPERSET)`.

Internal shape: every node-level differ has the **uniform signature**
`_diff_<x>(node, parent_path, om, mode, diffs)`. The single `_diff_node`
entry point dispatches on `type(node)` via `_DIFFERS`, and each differ
recurses into children by calling `_diff_node` on them. Adding a new
node type (e.g. ExpectedView) is one registry entry plus one function.
Parent-path threading is uniform: every differ receives the owning FQN
and builds `self_fqn = f"{parent_path}.{node.name}"` the same way.

Diffs use bracket-path notation (`service[foo].database[bar].table[baz].
column[qux].dataType`) for readability in pytest failure output.
"""

from __future__ import annotations

import re
from typing import Callable

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str

from ..source.types import Diff, DiffKind
from .types import (
    ExpectedColumn,
    ExpectedDatabase,
    ExpectedSchema,
    ExpectedService,
    ExpectedStoredProcedure,
    ExpectedTable,
    MatchMode,
)
from ..fluent.om_client import OmClient


class StructuralMismatch(AssertionError):
    """Aggregate assertion error carrying all collected diffs.

    Renders with a summary header (counts by category) and path-sorted body
    grouped by owning entity — so a failure with 20 column diffs is
    scannable rather than a wall of text.
    """

    def __init__(self, diffs: list[Diff]) -> None:
        self.diffs = list(diffs)
        super().__init__(self._format(self.diffs))

    @staticmethod
    def _format(diffs: list[Diff]) -> str:
        if not diffs:
            return "StructuralMismatch: (no diffs)"

        sorted_diffs = sorted(diffs, key=lambda d: d.path)
        classified = [(d, *_classify_path(d.path)) for d in sorted_diffs]

        # Header: category counts, most-frequent first, alphabetical on ties.
        counts: dict[str, int] = {}
        for _, _, category in classified:
            counts[category] = counts.get(category, 0) + 1
        summary = ", ".join(
            f"{n} {cat}{'' if n == 1 else 's'}"
            for cat, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        )
        header = (
            f"StructuralMismatch: {len(sorted_diffs)} diff"
            f"{'' if len(sorted_diffs) == 1 else 's'} ({summary})"
        )

        # Body: diffs grouped by owning-entity scope.
        body_lines: list[str] = []
        last_scope: str | None = None
        for d, scope, _ in classified:
            if last_scope is not None and scope != last_scope:
                body_lines.append("")  # blank line between entity scopes
            last_scope = scope
            body_lines.append(str(d))

        return header + "\n" + "\n".join(body_lines)


# One table driving both category tally and scope clustering.
#   token:    substring searched for in the path string
#   category: label used in the summary header
#   is_scope: whether this level counts as an owning-entity scope (the
#             body groups diffs by the finest scope-level bracket segment).
#             Column / seed diffs are category buckets but NOT scope
#             levels — they cluster under their owning table.
# Ordered from finest-grained to coarsest; both passes walk top-to-bottom
# so the first hit wins for category and scope alike.
_PATH_LEVELS: tuple[tuple[str, str, bool], ...] = (
    (".column[",    "column",    False),
    (".seed",       "seed",      False),
    ("procedure[",  "procedure", True),
    ("view[",       "view",      True),
    ("table[",      "table",     True),
    ("schema[",     "schema",    True),
    ("database[",   "database",  True),
    ("service[",    "service",   True),
)


def _classify_path(path: str) -> tuple[str, str]:
    """Return (scope, category) for a diff path in one pass.

    `category` = the finest-grained level token present in the path,
    used for the summary-line tally.
    `scope` = the owning-entity bracket segment (e.g. `table[customers]`),
    used to cluster related diffs in the failure body. Columns and seeds
    collapse into their owning table's scope rather than introducing a
    scope of their own. Falls back to the whole path when no bracket
    token matches.
    """
    category: str | None = None
    scope: str | None = None
    for token, label, is_scope in _PATH_LEVELS:
        if token not in path:
            continue
        if category is None:
            category = label
        if is_scope and scope is None:
            m = re.search(rf"{re.escape(token)}[^\]]+\]", path)
            if m:
                scope = m.group(0)
    return scope or path, category or "service"


def assert_service_matches(
    expected: ExpectedService,
    om: OmClient,
    *,
    mode: MatchMode = MatchMode.SUPERSET,
) -> None:
    """Walk `expected`, fetch actual state via `om.raw`, raise StructuralMismatch on diffs.

    SUPERSET (default): extras in actual are tolerated (cloud drift, unrelated tables).
    STRICT: actual must equal expected exactly.
    SUBSET: actual must be within expected (rare).
    """
    diffs: list[Diff] = []
    _diff_node(expected, parent_path="", om=om.raw, mode=mode, diffs=diffs)
    if diffs:
        raise StructuralMismatch(diffs)


# -----------------------------------------------------------------------------
# Node dispatch
# -----------------------------------------------------------------------------


_NodeDiffer = Callable[[object, str, OpenMetadata, MatchMode, list[Diff]], None]

_STRICT_LIST_LIMIT = 1000


def _diff_node(
    node: object,
    parent_path: str,
    om: OpenMetadata,
    mode: MatchMode,
    diffs: list[Diff],
) -> None:
    """Dispatch entry — looks up the per-type differ in `_DIFFERS`.

    Unknown node types are a plan bug, not a runtime condition — raising
    TypeError surfaces the mismatch at author time.
    """
    differ = _DIFFERS.get(type(node))
    if differ is None:
        raise TypeError(
            f"no differ registered for {type(node).__name__}; "
            f"add an entry to _DIFFERS in differ.py"
        )
    differ(node, parent_path, om, mode, diffs)


# -----------------------------------------------------------------------------
# Per-node differs — all have the same signature
#                    (node, parent_path, om, mode, diffs)
# -----------------------------------------------------------------------------


def _diff_service(
    node: object,
    parent_path: str,
    om: OpenMetadata,
    mode: MatchMode,
    diffs: list[Diff],
) -> None:
    assert isinstance(node, ExpectedService)
    assert parent_path == "", "ExpectedService must be the root node"
    self_fqn = node.name
    path = f"service[{node.name}]"

    actual = om.get_by_name(entity=DatabaseService, fqn=self_fqn)
    if actual is None:
        diffs.append(Diff(path=path, kind=DiffKind.MISSING))
        return
    if actual.serviceType != node.service_type:
        diffs.append(
            Diff(path=f"{path}.serviceType", expected=node.service_type, actual=actual.serviceType)
        )

    for child in node.databases:
        _diff_node(child, self_fqn, om, mode, diffs)

    if mode == MatchMode.STRICT:
        _check_strict_extras(
            entity_cls=Database,
            expected_names={d.name for d in node.databases},
            list_params={"service": self_fqn},
            path_fmt=f"{path}.database[{{name}}](strict)",
            om=om,
            diffs=diffs,
        )


def _diff_database(
    node: object,
    parent_path: str,
    om: OpenMetadata,
    mode: MatchMode,
    diffs: list[Diff],
) -> None:
    assert isinstance(node, ExpectedDatabase)
    self_fqn = f"{parent_path}.{node.name}"
    path = f"service[{parent_path}].database[{node.name}]"

    actual = om.get_by_name(entity=Database, fqn=self_fqn)
    if actual is None:
        diffs.append(Diff(path=path, kind=DiffKind.MISSING))
        return

    for child in node.schemas:
        _diff_node(child, self_fqn, om, mode, diffs)

    if mode == MatchMode.STRICT:
        _check_strict_extras(
            entity_cls=DatabaseSchema,
            expected_names={s.name for s in node.schemas},
            list_params={"database": self_fqn},
            path_fmt=f"{self_fqn}.schema[{{name}}](strict)",
            om=om,
            diffs=diffs,
        )


def _diff_schema(
    node: object,
    parent_path: str,
    om: OpenMetadata,
    mode: MatchMode,
    diffs: list[Diff],
) -> None:
    assert isinstance(node, ExpectedSchema)
    self_fqn = f"{parent_path}.{node.name}"
    path = f"{parent_path}.schema[{node.name}]"

    actual = om.get_by_name(entity=DatabaseSchema, fqn=self_fqn)
    if actual is None:
        diffs.append(Diff(path=path, kind=DiffKind.MISSING))
        return

    for child in node.tables:
        _diff_node(child, self_fqn, om, mode, diffs)
    for child in node.stored_procedures:
        _diff_node(child, self_fqn, om, mode, diffs)

    if mode == MatchMode.STRICT:
        _check_strict_extras(
            entity_cls=Table,
            expected_names={t.name for t in node.tables},
            list_params={"databaseSchema": self_fqn},
            path_fmt=f"{path}.table[{{name}}](strict)",
            om=om,
            diffs=diffs,
        )
        _check_strict_extras(
            entity_cls=StoredProcedure,
            expected_names={sp.name for sp in node.stored_procedures},
            list_params={"databaseSchema": self_fqn},
            path_fmt=f"{path}.procedure[{{name}}](strict)",
            om=om,
            diffs=diffs,
        )


def _diff_table(
    node: object,
    parent_path: str,
    om: OpenMetadata,
    mode: MatchMode,
    diffs: list[Diff],
) -> None:
    assert isinstance(node, ExpectedTable)
    self_fqn = f"{parent_path}.{node.name}"
    path = f"table[{node.name}]"

    actual = om.get_by_name(
        entity=Table, fqn=self_fqn, fields=["tags", "owners", "columns"]
    )
    if actual is None:
        diffs.append(Diff(path=path, kind=DiffKind.MISSING))
        return

    # owner (single-owner check — matches when exp.owner appears in any actual owner)
    if node.owner is not None:
        owners = actual.owners.root if actual.owners else []
        actual_owners = {o.name for o in owners}
        if node.owner not in actual_owners:
            diffs.append(Diff(path=f"{path}.owner", expected=node.owner, actual=sorted(actual_owners)))

    # tags (subset match — all expected tags must be present).
    if node.tags:
        actual_tags = {model_str(t.tagFQN) for t in (actual.tags or [])}
        if node.tags - actual_tags:
            diffs.append(Diff(path=f"{path}.tags", expected=sorted(node.tags), actual=sorted(actual_tags)))

    # description (substring match per Decision #16)
    if node.description is not None:
        actual_desc = model_str(actual.description) if actual.description else ""
        if node.description not in actual_desc:
            diffs.append(
                Diff(path=f"{path}.description", expected=f"contains {node.description!r}", actual=actual_desc)
            )

    # columns — no separate OM fetch; walk the actual.columns set in place.
    actual_columns_by_name = {model_str(c.name): c for c in (actual.columns or [])}
    for exp_col in node.columns:
        _diff_column(exp_col, path, actual_columns_by_name, diffs)

    if mode == MatchMode.STRICT:
        expected_names = {c.name for c in node.columns}
        extra = set(actual_columns_by_name.keys()) - expected_names
        if extra:
            diffs.append(
                Diff(
                    path=f"{path}.columns(strict)",
                    kind=DiffKind.UNEXPECTED,
                    actual=sorted(extra),
                )
            )


def _diff_stored_procedure(
    node: object,
    parent_path: str,
    om: OpenMetadata,
    mode: MatchMode,
    diffs: list[Diff],
) -> None:
    assert isinstance(node, ExpectedStoredProcedure)
    self_fqn = f"{parent_path}.{node.name}"
    path = f"procedure[{node.name}]"

    actual = om.get_by_name(entity=StoredProcedure, fqn=self_fqn)
    if actual is None:
        diffs.append(Diff(path=path, kind=DiffKind.MISSING))
        return

    if node.description is not None:
        actual_desc = model_str(actual.description) if actual.description else ""
        if node.description not in actual_desc:
            diffs.append(
                Diff(path=f"{path}.description", expected=f"contains {node.description!r}", actual=actual_desc)
            )


# Column-level diffs don't fetch from OM and don't recurse, so they're NOT
# registered in _DIFFERS. `_diff_table` calls this helper directly for each
# expected column with the already-fetched `actual.columns` dict.
def _diff_column(
    exp_col: ExpectedColumn,
    table_path: str,
    actual_columns_by_name: dict,
    diffs: list[Diff],
) -> None:
    path = f"{table_path}.column[{exp_col.name}]"
    actual = actual_columns_by_name.get(exp_col.name)
    if actual is None:
        diffs.append(Diff(path=path, kind=DiffKind.MISSING))
        return
    if actual.dataType != exp_col.data_type:
        diffs.append(Diff(path=f"{path}.dataType", expected=exp_col.data_type, actual=actual.dataType))
    if exp_col.constraint is not None and actual.constraint != exp_col.constraint:
        diffs.append(Diff(path=f"{path}.constraint", expected=exp_col.constraint, actual=actual.constraint))
    if exp_col.tags:
        actual_tags = {model_str(t.tagFQN) for t in (actual.tags or [])}
        if exp_col.tags - actual_tags:
            diffs.append(Diff(path=f"{path}.tags", expected=sorted(exp_col.tags), actual=sorted(actual_tags)))
    if exp_col.description is not None:
        actual_desc = model_str(actual.description) if actual.description else ""
        if exp_col.description not in actual_desc:
            diffs.append(
                Diff(path=f"{path}.description", expected=f"contains {exp_col.description!r}", actual=actual_desc)
            )


def _check_strict_extras(
    *,
    entity_cls: type,
    expected_names: set[str],
    list_params: dict[str, str],
    path_fmt: str,
    om: OpenMetadata,
    diffs: list[Diff],
) -> None:
    """Flag actual entities under a parent that weren't declared as expected.

    `path_fmt` must contain a `{name}` slot filled with each extra entity's
    name at emit time. Pagination: capped at _STRICT_LIST_LIMIT — fine for
    e2e-sized services.
    """
    for actual in om.list_all_entities(
        entity=entity_cls, params=list_params, limit=_STRICT_LIST_LIMIT
    ):
        name = model_str(actual.name)
        if name in expected_names:
            continue
        diffs.append(Diff(path=path_fmt.format(name=name), kind=DiffKind.UNEXPECTED))


# Registry is declared AFTER the per-node differs so it can reference them
# by name. Adding a new node type = one function above + one entry here.
_DIFFERS: dict[type, _NodeDiffer] = {
    ExpectedService:          _diff_service,
    ExpectedDatabase:         _diff_database,
    ExpectedSchema:           _diff_schema,
    ExpectedTable:            _diff_table,
    ExpectedStoredProcedure:  _diff_stored_procedure,
}
