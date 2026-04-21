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

from dataclasses import dataclass

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.ometa.ometa_api import OpenMetadata

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

    Rendered as a multi-line message so pytest's default failure output surfaces
    every diff at once instead of short-circuiting on the first one.
    """

    def __init__(self, diffs: list[Diff]) -> None:
        self.diffs = diffs
        message = "StructuralMismatch:\n" + "\n".join(str(d) for d in diffs)
        super().__init__(message)


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
        _check_strict_schema_extras(
            exp_schema=exp_schema,
            schema_fqn=schema_fqn,
            om=om,
            diffs=diffs,
        )


def _check_strict_schema_extras(
    *,
    exp_schema: ExpectedSchema,
    schema_fqn: str,
    om: OpenMetadata,
    diffs: list[Diff],
) -> None:
    """In STRICT mode, flag actual tables and stored procedures in the schema
    that weren't declared in the expected spec. Required by filter tests that
    need to verify "exclude" semantics — merely walking declared items isn't
    enough, because missing the walk of actuals leaves extras invisible.
    """
    expected_table_names = {t.name for t in exp_schema.tables}
    actual_tables = om.list_all_entities(
        entity=Table,
        params={"databaseSchema": schema_fqn},
        limit=1000,
    )
    for actual in actual_tables:
        actual_name = actual.name.root
        if actual_name not in expected_table_names:
            diffs.append(
                Diff(
                    path=f"{schema_fqn}.schema[{exp_schema.name}].table[{actual_name}](strict)",
                    expected="not present",
                    actual="present",
                )
            )

    expected_sp_names = {sp.name for sp in exp_schema.stored_procedures}
    actual_sps = om.list_all_entities(
        entity=StoredProcedure,
        params={"databaseSchema": schema_fqn},
        limit=1000,
    )
    for actual in actual_sps:
        actual_name = actual.name.root
        if actual_name not in expected_sp_names:
            diffs.append(
                Diff(
                    path=f"{schema_fqn}.schema[{exp_schema.name}].procedure[{actual_name}](strict)",
                    expected="not present",
                    actual="present",
                )
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

    # tags (subset match — all expected tags must be present)
    if exp_table.tags:
        actual_tags = {t.tagFQN for t in (actual.tags or [])}
        missing = exp_table.tags - actual_tags
        if missing:
            diffs.append(
                Diff(f"{path}.tags", sorted(exp_table.tags), sorted(actual_tags))
            )

    # description (substring match per Decision #16)
    if exp_table.description is not None:
        actual_desc = actual.description.root if actual.description else ""
        if exp_table.description not in actual_desc:
            diffs.append(
                Diff(
                    f"{path}.description",
                    f"contains {exp_table.description!r}",
                    actual_desc,
                )
            )

    # columns
    actual_columns_by_name = {c.name.root: c for c in (actual.columns or [])}
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
        actual_tags = {t.tagFQN for t in (actual.tags or [])}
        missing = exp_col.tags - actual_tags
        if missing:
            diffs.append(
                Diff(f"{path}.tags", sorted(exp_col.tags), sorted(actual_tags))
            )
    if exp_col.description is not None:
        actual_desc = actual.description.root if actual.description else ""
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
        actual_desc = actual.description.root if actual.description else ""
        if exp_sp.description not in actual_desc:
            diffs.append(
                Diff(
                    f"{path}.description",
                    f"contains {exp_sp.description!r}",
                    actual_desc,
                )
            )
