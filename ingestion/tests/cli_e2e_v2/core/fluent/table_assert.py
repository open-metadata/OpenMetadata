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
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str

from .entity_assert import EntityAssert
from .lineage_assert import LineageAssert
from .profile_assert import ProfileAssert


class TableAssert(EntityAssert[Table]):
    """Fluent assertions on a single Table identified by FQN."""

    _entity_cls = Table
    _default_fields = ["tags", "owners", "columns"]

    # --- terminals ----------------------------------------------------

    def has_tag(self, fqn: str) -> "TableAssert":
        def _check() -> None:
            table = self._fetch()
            actual = {model_str(t.tagFQN) for t in (table.tags or [])}
            if fqn not in actual:
                raise AssertionError(
                    f"Table {self._fqn} missing tag {fqn!r}. Actual tags: {sorted(actual)}"
                )
        self._eventually.run(_check, name=f"has_tag({fqn})")
        return self

    def has_owner(self, name: str) -> "TableAssert":
        def _check() -> None:
            table = self._fetch()
            owners = table.owners.root if table.owners else []
            actual = {o.name for o in owners}
            if name not in actual:
                raise AssertionError(
                    f"Table {self._fqn} missing owner {name!r}. Actual owners: {sorted(actual)}"
                )
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

        MySQL lands FK data here — not as a lineage edge. Reads
        `tableConstraints`; matches by `ConstraintType.FOREIGN_KEY` + the
        owning column + suffix match on the referredColumn FQN.
        """
        def _check() -> None:
            table = self._fetch(fields=["tableConstraints"])
            constraints = list(table.tableConstraints or [])
            for c in constraints:
                if c.constraintType != ConstraintType.FOREIGN_KEY:
                    continue
                own_cols = {model_str(x) for x in (c.columns or [])}
                if column not in own_cols:
                    continue
                for ref in c.referredColumns or []:
                    ref_str = model_str(ref)
                    if ref_str.endswith(f".{referenced_table}.{referenced_column}"):
                        return
                    if ref_str == f"{referenced_table}.{referenced_column}":
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
        for c in table.columns or []:
            if model_str(c.name) == self._column_name:
                return c
        raise AssertionError(
            f"Column {self._column_name!r} not found on table {self._table_fqn}"
        )

    def has_tag(self, fqn: str) -> "ColumnAssert":
        column = self._fetch_column()
        actual = {model_str(t.tagFQN) for t in (column.tags or [])}
        if fqn not in actual:
            raise AssertionError(
                f"Column {self._table_fqn}.{self._column_name} missing tag {fqn!r}. "
                f"Actual tags: {sorted(actual)}"
            )
        return self

    def has_type(self, data_type: DataType) -> "ColumnAssert":
        column = self._fetch_column()
        if column.dataType != data_type:
            raise AssertionError(
                f"Column {self._table_fqn}.{self._column_name} has type {column.dataType}, "
                f"expected {data_type}"
            )
        return self

    def has_description_containing(self, text: str) -> "ColumnAssert":
        column = self._fetch_column()
        desc = model_str(column.description) if column.description else ""
        if text not in desc:
            raise AssertionError(
                f"Column {self._table_fqn}.{self._column_name} description does not contain {text!r}. "
                f"Actual: {desc!r}"
            )
        return self
