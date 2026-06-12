#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""TableAssert + ColumnAssert — fluent assertions on Table entities.

ColumnAssert inherits the parent TableAssert's runner, so column checks poll
when the table is armed via `.eventually()`.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar

from metadata.generated.schema.entity.data.table import (
    Column,
    ConstraintType,
    DataType,
    Table,
    TableConstraint,
)
from metadata.ingestion.ometa.utils import model_str

from .._om_compat import unwrap_root_list
from .entity_assert import EntityAssert
from .lineage_assert import LineageAssert
from .profile_assert import ProfileAssert

if TYPE_CHECKING:
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

    from .eventually import EventuallyRunner


def _fk_matches(
    constraint: TableConstraint,
    column: str,
    referenced_table: str,
    referenced_column: str,
) -> bool:
    """True if `constraint` is a FOREIGN_KEY on `column` pointing at `referenced_table.referenced_column`.

    Accepts both full FQN and short `table.column` forms via tail-match.
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
    _default_fields: ClassVar[list[str]] = ["tags", "owners", "columns"]

    # --- terminals ----------------------------------------------------

    def has_tag(self, fqn: str) -> TableAssert:
        def _check() -> None:
            table = self._fetch()
            actual = {model_str(t.tagFQN) for t in unwrap_root_list(table.tags)}
            if fqn not in actual:
                raise AssertionError(f"Table {self._fqn} missing tag {fqn!r}. Actual tags: {sorted(actual)}")

        self._eventually.run(_check, name=f"has_tag({fqn})")
        return self

    def has_owner(self, name: str) -> TableAssert:
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
    ) -> TableAssert:
        """Assert the table carries a FOREIGN_KEY constraint on `column` -> `referenced_table.referenced_column`."""

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

    def has_schema_definition_containing(self, text: str) -> TableAssert:
        """Assert `schemaDefinition` contains `text` — case-insensitive substring match."""
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

    def is_soft_deleted(self) -> TableAssert:
        """Assert the table exists in OM but is marked `deleted=True`."""

        def _check() -> None:
            if not self._fetch_any_state().deleted:
                raise AssertionError(f"Table {self._fqn} is not soft-deleted (deleted=False)")

        self._eventually.run(_check, name="is_soft_deleted")
        return self

    def is_not_deleted(self) -> TableAssert:
        """Assert the table exists in OM with `deleted=False`."""

        def _check() -> None:
            entity = self._fetch_any_state()
            if entity.deleted:
                raise AssertionError(f"Table {self._fqn} is unexpectedly soft-deleted (deleted=True)")

        self._eventually.run(_check, name="is_not_deleted")
        return self

    def _fetch_any_state(self) -> Table:
        """Fetch the table including soft-deleted state."""
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

    def column(self, name: str) -> ColumnAssert:
        return ColumnAssert(self._om, self._fqn, name, runner=self._eventually)

    @property
    def lineage(self) -> LineageAssert:
        return LineageAssert(self._om, self._fqn)

    @property
    def profile(self) -> ProfileAssert:
        return ProfileAssert(self._om, self._fqn)


class ColumnAssert:
    """Assertions on a named column of a Table; polls when armed via the parent's `.eventually()`."""

    def __init__(self, om: OpenMetadata, table_fqn: str, column_name: str, runner: EventuallyRunner) -> None:
        self._om = om
        self._table_fqn = table_fqn
        self._column_name = column_name
        self._eventually = runner

    def _label(self, check: str) -> str:
        return f"column({self._table_fqn}.{self._column_name}).{check}"

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

    def has_tag(self, fqn: str) -> ColumnAssert:
        def _check() -> None:
            column = self._fetch_column()
            actual = {model_str(t.tagFQN) for t in unwrap_root_list(column.tags)}
            if fqn not in actual:
                raise AssertionError(
                    f"Column {self._table_fqn}.{self._column_name} missing tag {fqn!r}. Actual tags: {sorted(actual)}"
                )

        self._eventually.run(_check, name=self._label(f"has_tag({fqn})"))
        return self

    def has_no_tag(self, fqn: str) -> ColumnAssert:
        """Assert the column does NOT carry the given tag."""

        def _check() -> None:
            column = self._fetch_column()
            actual = {model_str(t.tagFQN) for t in unwrap_root_list(column.tags)}
            if fqn in actual:
                raise AssertionError(
                    f"Column {self._table_fqn}.{self._column_name} unexpectedly "
                    f"carries tag {fqn!r}. Actual tags: {sorted(actual)}"
                )

        self._eventually.run(_check, name=self._label(f"has_no_tag({fqn})"))
        return self

    def has_type(self, data_type: DataType) -> ColumnAssert:
        def _check() -> None:
            column = self._fetch_column()
            if column.dataType != data_type:
                raise AssertionError(
                    f"Column {self._table_fqn}.{self._column_name} has type {column.dataType}, expected {data_type}"
                )

        self._eventually.run(_check, name=self._label(f"has_type({data_type})"))
        return self

    def has_description_containing(self, text: str) -> ColumnAssert:
        def _check() -> None:
            column = self._fetch_column()
            desc = model_str(column.description) if column.description else ""
            if text not in desc:
                raise AssertionError(
                    f"Column {self._table_fqn}.{self._column_name} description does not contain "
                    f"{text!r}. Actual: {desc!r}"
                )

        self._eventually.run(_check, name=self._label(f"has_description_containing({text!r})"))
        return self
