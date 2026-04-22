#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Structural differ — walks an Expected* tree, fetches actual OM state per-level,
collects path-qualified diffs, raises StructuralMismatch when anything doesn't match.

Public surface: `assert_service_matches(expected, om, mode=SUPERSET)`.

The walk is deliberately level-by-level — each level does its own `get_by_name`
so that a missing parent (e.g., a Database that wasn't created) short-circuits
cleanly rather than producing cascading "column X missing" errors. Diffs use
bracket-path notation (`service[foo].database[bar].table[baz].column[qux].dataType`)
for readability in pytest failure output.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str

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


@dataclass
class Diff:
    """One path-qualified discrepancy between expected and actual."""

    path: str
    expected: object
    actual: object

    def __str__(self) -> str:
        return (
            f"  {self.path}:\n"
            f"    expected: {self.expected!r}\n"
            f"    actual:   {self.actual!r}"
        )


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
        summary = _category_summary(sorted_diffs)
        header = (
            f"StructuralMismatch: {len(sorted_diffs)} diff"
            f"{'' if len(sorted_diffs) == 1 else 's'} ({summary})"
        )

        body_lines: list[str] = []
        last_scope: str | None = None
        for d in sorted_diffs:
            scope = _scope_of(d.path)
            if last_scope is not None and scope != last_scope:
                body_lines.append("")  # blank line between entity scopes
            last_scope = scope
            body_lines.append(str(d))

        return header + "\n" + "\n".join(body_lines)


# Scope extraction — returns the "owning entity" segment so diffs for the
# same table/procedure/view cluster together in the rendered message.
_SCOPE_LEVELS = ("procedure", "view", "table", "schema", "database", "service")


def _scope_of(path: str) -> str:
    for level in _SCOPE_LEVELS:
        m = re.search(rf"{level}\[[^\]]+\]", path)
        if m:
            return m.group(0)
    return path


def _category_summary(diffs: list[Diff]) -> str:
    """Build 'N column, M table, K procedure diffs' line for the header."""
    counts: dict[str, int] = {}
    for d in diffs:
        cat = _category_of(d.path)
        counts[cat] = counts.get(cat, 0) + 1
    parts = [
        f"{n} {cat}{'' if n == 1 else 's'}"
        for cat, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]
    return ", ".join(parts)


def _category_of(path: str) -> str:
    """Coarse category for the summary line — ordered from most specific."""
    if ".column[" in path:
        return "column"
    if ".seed" in path:
        return "seed"
    if "procedure[" in path:
        return "procedure"
    if "view[" in path:
        return "view"
    if "table[" in path:
        return "table"
    if "schema[" in path:
        return "schema"
    if "database[" in path:
        return "database"
    return "service"


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
    _diff_service(expected, om.raw, mode, diffs)
    if diffs:
        raise StructuralMismatch(diffs)


_STRICT_LIST_LIMIT = 1000


def _diff_service(
    exp: ExpectedService,
    om: OpenMetadata,
    mode: MatchMode,
    diffs: list[Diff],
) -> None:
    path = f"service[{exp.name}]"
    actual = om.get_by_name(entity=DatabaseService, fqn=exp.name)
    if actual is None:
        diffs.append(Diff(path, "present", "missing"))
        return
    if actual.serviceType != exp.service_type:
        diffs.append(Diff(f"{path}.serviceType", exp.service_type, actual.serviceType))
    for exp_db in exp.databases:
        _diff_database(exp_db, exp.name, om, mode, diffs)

    if mode == MatchMode.STRICT:
        _check_strict_extras(
            entity_cls=Database,
            expected_names={d.name for d in exp.databases},
            list_params={"service": exp.name},
            path_fmt=f"service[{exp.name}].database[{{name}}](strict)",
            om=om,
            diffs=diffs,
        )


def _diff_database(
    exp_db: ExpectedDatabase,
    service_name: str,
    om: OpenMetadata,
    mode: MatchMode,
    diffs: list[Diff],
) -> None:
    db_fqn = f"{service_name}.{exp_db.name}"
    path = f"service[{service_name}].database[{exp_db.name}]"
    actual = om.get_by_name(entity=Database, fqn=db_fqn)
    if actual is None:
        diffs.append(Diff(path, "present", "missing"))
        return
    for exp_schema in exp_db.schemas:
        _diff_schema(exp_schema, db_fqn, om, mode, diffs)

    if mode == MatchMode.STRICT:
        _check_strict_extras(
            entity_cls=DatabaseSchema,
            expected_names={s.name for s in exp_db.schemas},
            list_params={"database": db_fqn},
            path_fmt=f"{db_fqn}.schema[{{name}}](strict)",
            om=om,
            diffs=diffs,
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

    Used for STRICT-mode extras detection at every nesting level
    (databases under a service, schemas under a database, tables + stored
    procedures under a schema). `path_fmt` must contain a `{name}` slot
    filled with each extra entity's name at emit time.

    Pagination: capped at _STRICT_LIST_LIMIT; fine for e2e-sized services.
    """
    actuals = om.list_all_entities(
        entity=entity_cls,
        params=list_params,
        limit=_STRICT_LIST_LIMIT,
    )
    for actual in actuals:
        name = model_str(actual.name)
        if name in expected_names:
            continue
        diffs.append(
            Diff(
                path=path_fmt.format(name=name),
                expected="not present",
                actual="present",
            )
        )


def _diff_schema(
    exp_schema: ExpectedSchema,
    db_fqn: str,
    om: OpenMetadata,
    mode: MatchMode,
    diffs: list[Diff],
) -> None:
    schema_fqn = f"{db_fqn}.{exp_schema.name}"
    path = f"{db_fqn}.schema[{exp_schema.name}]"
    actual = om.get_by_name(entity=DatabaseSchema, fqn=schema_fqn)
    if actual is None:
        diffs.append(Diff(path, "present", "missing"))
        return
    for exp_table in exp_schema.tables:
        _diff_table(exp_table, schema_fqn, om, mode, diffs)

    for exp_sp in exp_schema.stored_procedures:
        _diff_stored_procedure(exp_sp, schema_fqn, om, diffs)

    if mode == MatchMode.STRICT:
        _check_strict_extras(
            entity_cls=Table,
            expected_names={t.name for t in exp_schema.tables},
            list_params={"databaseSchema": schema_fqn},
            path_fmt=f"{schema_fqn}.schema[{exp_schema.name}].table[{{name}}](strict)",
            om=om,
            diffs=diffs,
        )
        _check_strict_extras(
            entity_cls=StoredProcedure,
            expected_names={sp.name for sp in exp_schema.stored_procedures},
            list_params={"databaseSchema": schema_fqn},
            path_fmt=f"{schema_fqn}.schema[{exp_schema.name}].procedure[{{name}}](strict)",
            om=om,
            diffs=diffs,
        )


def _diff_table(
    exp_table: ExpectedTable,
    schema_fqn: str,
    om: OpenMetadata,
    mode: MatchMode,
    diffs: list[Diff],
) -> None:
    table_fqn = f"{schema_fqn}.{exp_table.name}"
    path = f"table[{exp_table.name}]"
    actual = om.get_by_name(
        entity=Table, fqn=table_fqn, fields=["tags", "owners", "columns"]
    )
    if actual is None:
        diffs.append(Diff(path, "present", "missing"))
        return

    # owner (single-owner check — matches when exp.owner appears in any actual owner)
    if exp_table.owner is not None:
        owners = actual.owners.root if actual.owners else []
        actual_owners = {o.name for o in owners}
        if exp_table.owner not in actual_owners:
            diffs.append(Diff(f"{path}.owner", exp_table.owner, sorted(actual_owners)))

    # tags (subset match — all expected tags must be present).
    # tagFQN is a Pydantic RootModel[str], so compare via model_str rather
    # than relying on str() / enum equality.
    if exp_table.tags:
        actual_tags = {model_str(t.tagFQN) for t in (actual.tags or [])}
        missing = exp_table.tags - actual_tags
        if missing:
            diffs.append(
                Diff(f"{path}.tags", sorted(exp_table.tags), sorted(actual_tags))
            )

    # description (substring match per Decision #16)
    if exp_table.description is not None:
        actual_desc = model_str(actual.description) if actual.description else ""
        if exp_table.description not in actual_desc:
            diffs.append(
                Diff(
                    f"{path}.description",
                    f"contains {exp_table.description!r}",
                    actual_desc,
                )
            )

    # columns
    actual_columns_by_name = {model_str(c.name): c for c in (actual.columns or [])}
    for exp_col in exp_table.columns:
        _diff_column(exp_col, path, actual_columns_by_name, diffs)

    # STRICT mode: flag unexpected columns that appeared in actual but not in expected
    if mode == MatchMode.STRICT:
        expected_names = {c.name for c in exp_table.columns}
        extra = set(actual_columns_by_name.keys()) - expected_names
        if extra:
            diffs.append(
                Diff(
                    f"{path}.columns(strict)",
                    "exactly declared set",
                    sorted(extra),
                )
            )


def _diff_column(
    exp_col: ExpectedColumn,
    table_path: str,
    actual_columns_by_name: dict,
    diffs: list[Diff],
) -> None:
    path = f"{table_path}.column[{exp_col.name}]"
    actual = actual_columns_by_name.get(exp_col.name)
    if actual is None:
        diffs.append(Diff(path, "present", "missing"))
        return
    if actual.dataType != exp_col.data_type:
        diffs.append(Diff(f"{path}.dataType", exp_col.data_type, actual.dataType))
    if exp_col.constraint is not None:
        if actual.constraint != exp_col.constraint:
            diffs.append(
                Diff(f"{path}.constraint", exp_col.constraint, actual.constraint)
            )
    if exp_col.tags:
        actual_tags = {model_str(t.tagFQN) for t in (actual.tags or [])}
        missing = exp_col.tags - actual_tags
        if missing:
            diffs.append(
                Diff(f"{path}.tags", sorted(exp_col.tags), sorted(actual_tags))
            )
    if exp_col.description is not None:
        actual_desc = model_str(actual.description) if actual.description else ""
        if exp_col.description not in actual_desc:
            diffs.append(
                Diff(
                    f"{path}.description",
                    f"contains {exp_col.description!r}",
                    actual_desc,
                )
            )


def _diff_stored_procedure(
    exp_sp: ExpectedStoredProcedure,
    schema_fqn: str,
    om: OpenMetadata,
    diffs: list[Diff],
) -> None:
    sp_fqn = f"{schema_fqn}.{exp_sp.name}"
    path = f"procedure[{exp_sp.name}]"
    actual = om.get_by_name(entity=StoredProcedure, fqn=sp_fqn)
    if actual is None:
        diffs.append(Diff(path, "present", "missing"))
        return
    if exp_sp.description is not None:
        actual_desc = model_str(actual.description) if actual.description else ""
        if exp_sp.description not in actual_desc:
            diffs.append(
                Diff(
                    f"{path}.description",
                    f"contains {exp_sp.description!r}",
                    actual_desc,
                )
            )
