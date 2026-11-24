#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Structural differ for Expected* trees.

Public surface: `catalog_matches(expected)` checks a complete catalog snapshot.
Diffs use bracket-path notation (e.g. `service[s].database[d].table[t].column[c].dataType`).
"""

from __future__ import annotations

import re
from collections import Counter
from typing import TYPE_CHECKING

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.fqn import quote_name

from ..._om_compat import unwrap_root_list
from .types import Diff, DiffKind

if TYPE_CHECKING:
    from collections.abc import Callable, Iterable

    from .snapshot import CatalogSnapshot
    from .types import (
        ExpectedColumn,
        ExpectedDatabase,
        ExpectedSchema,
        ExpectedService,
        ExpectedStoredProcedure,
        ExpectedTable,
    )


class StructuralMismatch(AssertionError):  # noqa: N818  (intentional API surface — public exception name)
    """Aggregate assertion error carrying all collected diffs; renders grouped by entity scope."""

    def __init__(self, diffs: list[Diff]) -> None:
        self.diffs = list(diffs)
        super().__init__(self._format(self.diffs))

    @staticmethod
    def _format(diffs: list[Diff]) -> str:
        if not diffs:
            return "StructuralMismatch: (no diffs)"

        sorted_diffs = sorted(diffs, key=lambda d: d.path)
        classified = [(d, *_classify_path(d.path)) for d in sorted_diffs]

        counts: dict[str, int] = {}
        for _, _, category in classified:
            counts[category] = counts.get(category, 0) + 1
        summary = ", ".join(
            f"{n} {cat}{'' if n == 1 else 's'}" for cat, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        )
        header = f"StructuralMismatch: {len(sorted_diffs)} diff{'' if len(sorted_diffs) == 1 else 's'} ({summary})"

        body_lines: list[str] = []
        last_scope: str | None = None
        for d, scope, _ in classified:
            if last_scope is not None and scope != last_scope:
                body_lines.append("")  # blank line between entity scopes
            last_scope = scope
            body_lines.append(str(d))

        return header + "\n" + "\n".join(body_lines)


# (token, category, is_scope) — ordered finest-to-coarsest; first hit wins.
# Columns/seeds are category buckets but not scope levels (cluster under their table).
_PATH_LEVELS: tuple[tuple[str, str, bool], ...] = (
    (".column[", "column", False),
    (".seed", "seed", False),
    ("procedure[", "procedure", True),
    ("view[", "view", True),
    ("table[", "table", True),
    ("schema[", "schema", True),
    ("database[", "database", True),
    ("service[", "service", True),
)


def _classify_path(path: str) -> tuple[str, str]:
    """Return (scope, category) for a diff path.

    `scope` is the finest owning-entity bracket segment (e.g. `table[customers]`);
    columns and seeds collapse into their owning table's scope. Falls back to the
    whole path when no bracket token matches.
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


def catalog_matches(expected: ExpectedService) -> Callable[[CatalogSnapshot], None]:
    def check(snapshot: CatalogSnapshot) -> None:
        diffs: list[Diff] = []
        _check_inventory(expected, snapshot, diffs)
        _diff_service(expected, snapshot, diffs)
        if diffs:
            raise StructuralMismatch(diffs)

    return check


def _check_duplicates(names: Iterable[str], path: str, diffs: list[Diff]) -> None:
    for name, count in Counter(names).items():
        if count > 1:
            diffs.append(Diff(path=f"{path}[{name}].duplicates", expected=1, actual=count))


def _check_inventory(expected: ExpectedService, snapshot: CatalogSnapshot, diffs: list[Diff]) -> None:
    parents: dict[type, dict[str, str]] = {Database: {}, DatabaseSchema: {}, Table: {}, StoredProcedure: {}}
    service_fqn = quote_name(expected.name)
    for database in expected.databases:
        database_fqn = f"{service_fqn}.{quote_name(database.name)}"
        parents[Database][database_fqn] = service_fqn
        for schema in database.schemas:
            schema_fqn = f"{database_fqn}.{quote_name(schema.name)}"
            parents[DatabaseSchema][schema_fqn] = database_fqn
            for table in schema.tables:
                parents[Table][f"{schema_fqn}.{quote_name(table.name)}"] = schema_fqn
            for procedure in schema.stored_procedures:
                parents[StoredProcedure][f"{schema_fqn}.{quote_name(procedure.name)}"] = schema_fqn

    for entity, label, parent_field, parent_type in (
        (Database, "database", "service", DatabaseService),
        (DatabaseSchema, "schema", "database", Database),
        (Table, "table", "databaseSchema", DatabaseSchema),
        (StoredProcedure, "procedure", "databaseSchema", DatabaseSchema),
    ):
        observed = snapshot.entities(entity)
        _check_duplicates((model_str(item.fullyQualifiedName) for item in observed), label, diffs)
        for actual in observed:
            actual_fqn = model_str(actual.fullyQualifiedName) if actual.fullyQualifiedName is not None else None
            path = f"{label}[{actual_fqn or model_str(actual.name)}]"
            if not actual_fqn:
                diffs.append(Diff(path=f"{path}.fullyQualifiedName", expected="non-empty FQN", actual=actual_fqn))
                continue
            parent_fqn = parents[entity].get(actual_fqn)
            if parent_fqn is None:
                diffs.append(Diff(path=f"{path}(strict)", kind=DiffKind.UNEXPECTED))
                continue
            reference = getattr(actual, parent_field)
            reference_fqn = reference.fullyQualifiedName if reference is not None else None
            if reference_fqn != parent_fqn:
                diffs.append(
                    Diff(path=f"{path}.{parent_field}.fullyQualifiedName", expected=parent_fqn, actual=reference_fqn)
                )
            parent = snapshot.find(parent_type, parent_fqn)
            reference_id = model_str(reference.id) if reference is not None else None
            if parent is not None and reference_id != model_str(parent.id):
                diffs.append(Diff(path=f"{path}.{parent_field}.id", expected=model_str(parent.id), actual=reference_id))


def _diff_service(
    node: ExpectedService,
    snapshot: CatalogSnapshot,
    diffs: list[Diff],
) -> None:
    self_fqn = quote_name(node.name)
    path = f"service[{node.name}]"

    actual = snapshot.find(DatabaseService, self_fqn)
    if actual is None:
        diffs.append(Diff(path=path, kind=DiffKind.MISSING))
        return
    if actual.serviceType != node.service_type:
        diffs.append(Diff(path=f"{path}.serviceType", expected=node.service_type, actual=actual.serviceType))

    for database in node.databases:
        _diff_database(database, self_fqn, snapshot, diffs)


def _diff_database(
    node: ExpectedDatabase,
    parent_path: str,
    snapshot: CatalogSnapshot,
    diffs: list[Diff],
) -> None:
    self_fqn = f"{parent_path}.{quote_name(node.name)}"
    path = f"service[{parent_path}].database[{node.name}]"

    actual = snapshot.find(Database, self_fqn)
    if actual is None:
        diffs.append(Diff(path=path, kind=DiffKind.MISSING))
        return

    for schema in node.schemas:
        _diff_schema(schema, self_fqn, snapshot, diffs)


def _diff_schema(
    node: ExpectedSchema,
    parent_path: str,
    snapshot: CatalogSnapshot,
    diffs: list[Diff],
) -> None:
    self_fqn = f"{parent_path}.{quote_name(node.name)}"
    path = f"{parent_path}.schema[{node.name}]"

    actual = snapshot.find(DatabaseSchema, self_fqn)
    if actual is None:
        diffs.append(Diff(path=path, kind=DiffKind.MISSING))
        return

    for table in node.tables:
        _diff_table(table, self_fqn, snapshot, diffs)
    for procedure in node.stored_procedures:
        _diff_stored_procedure(procedure, self_fqn, snapshot, diffs)


def _diff_table(
    node: ExpectedTable,
    parent_path: str,
    snapshot: CatalogSnapshot,
    diffs: list[Diff],
) -> None:
    self_fqn = f"{parent_path}.{quote_name(node.name)}"
    path = f"{parent_path}.table[{node.name}]"

    actual = snapshot.find(Table, self_fqn)
    if actual is None:
        diffs.append(Diff(path=path, kind=DiffKind.MISSING))
        return

    if node.table_type is not None and actual.tableType != node.table_type:
        diffs.append(Diff(path=f"{path}.tableType", expected=node.table_type, actual=actual.tableType))

    # owner: matches when exp.owner appears in any actual owner
    if node.owner is not None:
        actual_owners = {o.name for o in unwrap_root_list(actual.owners)}
        if node.owner not in actual_owners:
            diffs.append(Diff(path=f"{path}.owner", expected=node.owner, actual=sorted(actual_owners)))

    # tags: subset match — all expected tags must be present
    if node.tags:
        actual_tags = {model_str(t.tagFQN) for t in unwrap_root_list(actual.tags)}
        if node.tags - actual_tags:
            diffs.append(Diff(path=f"{path}.tags", expected=sorted(node.tags), actual=sorted(actual_tags)))

    if node.description is not None:
        actual_desc = model_str(actual.description) if actual.description is not None else None
        if node.description != actual_desc:
            diffs.append(Diff(path=f"{path}.description", expected=node.description, actual=actual_desc))

    actual_columns = unwrap_root_list(actual.columns)
    _check_duplicates((model_str(c.name) for c in actual_columns), f"{path}.column", diffs)
    actual_columns_by_name = {model_str(c.name): c for c in actual_columns}
    for exp_col in node.columns:
        _diff_column(exp_col, path, actual_columns_by_name, diffs)

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
    node: ExpectedStoredProcedure,
    parent_path: str,
    snapshot: CatalogSnapshot,
    diffs: list[Diff],
) -> None:
    self_fqn = f"{parent_path}.{quote_name(node.name)}"
    path = f"{parent_path}.procedure[{node.name}]"

    actual = snapshot.find(StoredProcedure, self_fqn)
    if actual is None:
        diffs.append(Diff(path=path, kind=DiffKind.MISSING))
        return

    if node.description is not None:
        actual_desc = model_str(actual.description) if actual.description is not None else None
        if node.description != actual_desc:
            diffs.append(Diff(path=f"{path}.description", expected=node.description, actual=actual_desc))


def _diff_column(
    exp_col: ExpectedColumn,
    table_path: str,
    actual_columns_by_name: dict[str, Column],
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
        actual_tags = {model_str(t.tagFQN) for t in unwrap_root_list(actual.tags)}
        if exp_col.tags - actual_tags:
            diffs.append(Diff(path=f"{path}.tags", expected=sorted(exp_col.tags), actual=sorted(actual_tags)))
    if exp_col.description is not None:
        actual_desc = model_str(actual.description) if actual.description is not None else None
        if exp_col.description != actual_desc:
            diffs.append(Diff(path=f"{path}.description", expected=exp_col.description, actual=actual_desc))
