#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""TableAssert + ColumnAssert — fluent assertions on Table entities.

TableAssert inherits shared fluent surface (exists / get / eventually /
has_description_containing) from `EntityAssert[Table]`. Entity-specific
terminals (tags, owners, FK constraint, column descent, lineage/profile
namespaces) live here.

ColumnAssert is synchronous — column checks on fresh ingests are reliable
in practice; polling chains off TableAssert.
"""

from __future__ import annotations

from metadata.generated.schema.entity.data.table import (
    Column,
    ConstraintType,
    DataType,
    Table,
    TableConstraint,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str

from .._om_compat import unwrap_root_list
from .entity_assert import EntityAssert
from .lineage_assert import LineageAssert
from .profile_assert import ProfileAssert


def _fk_matches(
    constraint: TableConstraint,
    column: str,
    referenced_table: str,
    referenced_column: str,
) -> bool:
    """True if `constraint` is a FOREIGN_KEY on `column` pointing at the
    named referred column.

    The referredColumns FQNs may be rendered as either the full
    `service.database.schema.table.column` form or the shorter
    `table.column` form depending on how OM resolved them at ingest time;
    both are accepted via tail-match.
    """
    if constraint.constraintType != ConstraintType.FOREIGN_KEY:
        return False
    own_cols = {model_str(x) for x in unwrap_root_list(constraint.columns)}
    if column not in own_cols:
        return False
    wanted_tail = f".{referenced_table}.{referenced_column}"
    wanted_short = f"{referenced_table}.{referenced_column}"
    return any(
        model_str(ref).endswith(wanted_tail) or model_str(ref) == wanted_short
        for ref in unwrap_root_list(constraint.referredColumns)
    )


class TableAssert(EntityAssert[Table]):
    """Fluent assertions on a single Table identified by FQN."""

    _entity_cls = Table
    _default_fields = ["tags", "owners", "columns"]

    # --- terminals ----------------------------------------------------

    def has_tag(self, fqn: str) -> "TableAssert":
        def _check() -> None:
            table = self._fetch()
            actual = {model_str(t.tagFQN) for t in unwrap_root_list(table.tags)}
            if fqn not in actual:
                raise AssertionError(f"Table {self._fqn} missing tag {fqn!r}. Actual tags: {sorted(actual)}")

        self._eventually.run(_check, name=f"has_tag({fqn})")
        return self

    def has_owner(self, name: str) -> "TableAssert":
        def _check() -> None:
            table = self._fetch()
            actual = {o.name for o in unwrap_root_list(table.owners)}
            if name not in actual:
                raise AssertionError(f"Table {self._fqn} missing owner {name!r}. Actual owners: {sorted(actual)}")

        self._eventually.run(_check, name=f"has_owner({name})")
        return self

    def has_foreign_key_constraint(
        self,
        column: str,
        referenced_table: str,
        referenced_column: str,
    ) -> "TableAssert":
        """Assert the table carries a FOREIGN_KEY TableConstraint on `column`
        pointing at `referenced_table.referenced_column`.

        MySQL lands FK data here — not as a lineage edge. Matching delegates
        to `_fk_matches`.
        """

        def _check() -> None:
            constraints = unwrap_root_list(self._fetch(fields=["tableConstraints"]).tableConstraints)
            if any(_fk_matches(c, column, referenced_table, referenced_column) for c in constraints):
                return
            raise AssertionError(
                f"Table {self._fqn} missing FOREIGN_KEY({column}) -> "
                f"{referenced_table}({referenced_column}). "
                f"Constraints present: {constraints!r}"
            )

        self._eventually.run(
            _check,
            name=f"has_foreign_key_constraint({column}->{referenced_table}.{referenced_column})",
        )
        return self

    def has_schema_definition_containing(self, text: str) -> "TableAssert":
        """Assert `schemaDefinition` (raw DDL stored on the entity) contains
        `text` — case-insensitive substring match.

        Populated for views when metadata ingest runs with `includeDDL=True`,
        and for tables when the connector emits CREATE TABLE bodies. Used as
        the prerequisite check that ingest actually plumbed DDL through —
        a failed lineage parse with empty `schemaDefinition` is a different
        bug than a failed parse on present DDL.

        Case insensitivity matters: MySQL normalizes view DDL to lowercase
        (`left join`, not `LEFT JOIN`); other dialects preserve case. The
        assertion keeps tests portable across dialects without each one
        having to know the specific casing.
        """
        wanted_lower = text.lower()

        def _check() -> None:
            entity = self._fetch(fields=["schemaDefinition"])
            actual = model_str(entity.schemaDefinition) if entity.schemaDefinition else ""
            if wanted_lower not in actual.lower():
                raise AssertionError(
                    f"Table {self._fqn} schemaDefinition does not contain "
                    f"{text!r} (case-insensitive). Actual: {actual!r}"
                )

        self._eventually.run(_check, name=f"has_schema_definition_containing({text!r})")
        return self

    def is_soft_deleted(self) -> "TableAssert":
        """Assert the table exists in OM but is marked `deleted=True`.

        Soft-deleted entities are filtered out of `get_by_name` by default.
        We use `list_entities` with `include=all` to find the entity even
        when soft-deleted, then check the `deleted` field. Used by
        mark-deleted tests after re-ingest with `markDeletedTables=True`.
        """

        def _check() -> None:
            if not self._fetch_any_state().deleted:
                raise AssertionError(f"Table {self._fqn} is not soft-deleted (deleted=False)")

        self._eventually.run(_check, name="is_soft_deleted")
        return self

    def is_not_deleted(self) -> "TableAssert":
        """Assert the table exists in OM with `deleted=False`."""

        def _check() -> None:
            entity = self._fetch_any_state()
            if entity.deleted:
                raise AssertionError(f"Table {self._fqn} is unexpectedly soft-deleted (deleted=True)")

        self._eventually.run(_check, name="is_not_deleted")
        return self

    def _fetch_any_state(self) -> Table:
        """Fetch the table including soft-deleted state (default get_by_name
        filters those out)."""
        entity = self._om.get_by_name(
            entity=Table,
            fqn=self._fqn,
            fields=["deleted"],
            include="all",
        )
        if entity is None:
            raise AssertionError(f"Table not found (in any state): {self._fqn}")
        return entity

    # --- descent into column / namespaces -----------------------------

    def column(self, name: str) -> "ColumnAssert":
        return ColumnAssert(self._om, self._fqn, name)

    @property
    def lineage(self) -> LineageAssert:
        return LineageAssert(self._om, self._fqn)

    @property
    def profile(self) -> ProfileAssert:
        return ProfileAssert(self._om, self._fqn)


class ColumnAssert:
    """Synchronous assertions on a named column of a Table."""

    def __init__(self, om: OpenMetadata, table_fqn: str, column_name: str) -> None:
        self._om = om
        self._table_fqn = table_fqn
        self._column_name = column_name

    def _fetch_column(self) -> Column:
        table = self._om.get_by_name(
            entity=Table,
            fqn=self._table_fqn,
            fields=["tags", "columns"],
        )
        if table is None:
            raise AssertionError(f"Table not found: {self._table_fqn}")
        for c in unwrap_root_list(table.columns):
            if model_str(c.name) == self._column_name:
                return c
        raise AssertionError(f"Column {self._column_name!r} not found on table {self._table_fqn}")

    def has_tag(self, fqn: str) -> "ColumnAssert":
        column = self._fetch_column()
        actual = {model_str(t.tagFQN) for t in unwrap_root_list(column.tags)}
        if fqn not in actual:
            raise AssertionError(
                f"Column {self._table_fqn}.{self._column_name} missing tag {fqn!r}. Actual tags: {sorted(actual)}"
            )
        return self

    def has_no_tag(self, fqn: str) -> "ColumnAssert":
        """Assert the column does NOT carry the given tag.

        Used as the negative complement to `has_tag` — guards against
        regressions where a classifier becomes overconfident and tags
        non-PII columns. Without this, a positive-only suite passes
        cleanly even when every column gets PII-flagged.
        """
        column = self._fetch_column()
        actual = {model_str(t.tagFQN) for t in unwrap_root_list(column.tags)}
        if fqn in actual:
            raise AssertionError(
                f"Column {self._table_fqn}.{self._column_name} unexpectedly "
                f"carries tag {fqn!r}. Actual tags: {sorted(actual)}"
            )
        return self

    def has_type(self, data_type: DataType) -> "ColumnAssert":
        column = self._fetch_column()
        if column.dataType != data_type:
            raise AssertionError(
                f"Column {self._table_fqn}.{self._column_name} has type {column.dataType}, expected {data_type}"
            )
        return self

    def has_description_containing(self, text: str) -> "ColumnAssert":
        column = self._fetch_column()
        desc = model_str(column.description) if column.description else ""
        if text not in desc:
            raise AssertionError(
                f"Column {self._table_fqn}.{self._column_name} description does not contain {text!r}. Actual: {desc!r}"
            )
        return self
