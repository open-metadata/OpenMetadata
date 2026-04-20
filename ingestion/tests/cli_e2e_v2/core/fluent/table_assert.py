#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""TableAssert + ColumnAssert — fluent assertions on Table entities."""

from __future__ import annotations

from typing import TYPE_CHECKING

from metadata.generated.schema.entity.data.table import DataType, Table
from metadata.ingestion.ometa.ometa_api import OpenMetadata

if TYPE_CHECKING:
    from tests.cli_e2e_v2.core.fluent.lineage_assert import LineageAssert
    from tests.cli_e2e_v2.core.fluent.profile_assert import ProfileAssert
    from tests.cli_e2e_v2.core.fluent.tests_assert import TestsAssert


class TableAssert:
    def __init__(self, om: OpenMetadata, fqn: str) -> None:
        self._om = om
        self._fqn = fqn
        self._eventually_timeout: int | None = None

    def _fetch(self) -> Table:
        table = self._om.get_by_name(
            entity=Table,
            fqn=self._fqn,
            fields=["tags", "owners", "columns"],
        )
        if table is None:
            raise AssertionError(f"Table not found: {self._fqn}")
        return table

    def exists(self) -> None:
        """Synchronous — primary API is consistent immediately post-ingest."""
        self._fetch()

    def get(self) -> Table:
        """Escape hatch — returns the raw Pydantic Table."""
        return self._fetch()

    def has_tag(self, fqn: str) -> "TableAssert":
        def _check() -> None:
            table = self._fetch()
            actual = {t.tagFQN for t in (table.tags or [])}
            if fqn not in actual:
                raise AssertionError(
                    f"Table {self._fqn} missing tag {fqn!r}. Actual tags: {sorted(actual)}"
                )
        self._apply_maybe_eventually(_check, name=f"has_tag({fqn})")
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
        self._apply_maybe_eventually(_check, name=f"has_owner({name})")
        return self

    def column(self, name: str) -> "ColumnAssert":
        return ColumnAssert(self._om, self._fqn, name)

    def eventually(self, timeout: int = 60) -> "TableAssert":
        """One-shot: the next terminal check on this builder polls until success/timeout."""
        self._eventually_timeout = timeout
        return self

    def _apply_maybe_eventually(self, check, *, name: str) -> None:
        if self._eventually_timeout is not None:
            from tests.cli_e2e_v2.core.fluent.eventually import retry_until
            retry_until(check, timeout=self._eventually_timeout, name=name)
            self._eventually_timeout = None
        else:
            check()

    @property
    def lineage(self) -> "LineageAssert":
        from tests.cli_e2e_v2.core.fluent.lineage_assert import LineageAssert
        return LineageAssert(self._om, self._fqn)

    @property
    def profile(self) -> "ProfileAssert":
        from tests.cli_e2e_v2.core.fluent.profile_assert import ProfileAssert
        return ProfileAssert(self._om, self._fqn)

    @property
    def tests(self) -> "TestsAssert":
        from tests.cli_e2e_v2.core.fluent.tests_assert import TestsAssert
        return TestsAssert(self._om, self._fqn)


class ColumnAssert:
    def __init__(self, om: OpenMetadata, table_fqn: str, column_name: str) -> None:
        self._om = om
        self._table_fqn = table_fqn
        self._column_name = column_name

    def _fetch_column(self):
        table = self._om.get_by_name(
            entity=Table,
            fqn=self._table_fqn,
            fields=["tags", "columns"],
        )
        if table is None:
            raise AssertionError(f"Table not found: {self._table_fqn}")
        for c in table.columns or []:
            if c.name.root == self._column_name:
                return c
        raise AssertionError(
            f"Column {self._column_name!r} not found on table {self._table_fqn}"
        )

    def has_tag(self, fqn: str) -> "ColumnAssert":
        column = self._fetch_column()
        actual = {t.tagFQN for t in (column.tags or [])}
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
        desc = column.description.root if column.description else ""
        if text not in desc:
            raise AssertionError(
                f"Column {self._table_fqn}.{self._column_name} description does not contain {text!r}. "
                f"Actual: {desc!r}"
            )
        return self
