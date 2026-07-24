#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Meta-tests: verify fluent assertion classes raise on mismatched OM state and pass on matching state."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import (
    ConstraintType,
    DataType,
    Table,
)

from ..core.fluent.stored_procedure_assert import StoredProcedureAssert
from ..core.fluent.table_assert import TableAssert

# --------------------------------------------------------------------------- #
# Stubs                                                                       #
# --------------------------------------------------------------------------- #


class _FakeOM:
    """Stub OpenMetadata client; keyed on `(entity_cls, fqn, include)` so deleted and live views are independent."""

    def __init__(self) -> None:
        self.entities: dict[tuple[type, str, str | None], Any] = {}

    def register(self, entity_cls: type, fqn: str, value: Any, *, include: str | None = None) -> None:
        self.entities[(entity_cls, fqn, include)] = value

    def get_by_name(self, *, entity, fqn, fields=None, include=None):
        return self.entities.get((entity, fqn, include))


def _table(
    *,
    columns: list[Any] | None = None,
    tags: list[str] | None = None,
    owners: list[str] | None = None,
    description: str | None = None,
    constraints: list[Any] | None = None,
    schema_definition: str | None = None,
    deleted: bool = False,
) -> SimpleNamespace:
    return SimpleNamespace(
        columns=columns or [],
        tags=[SimpleNamespace(tagFQN=t) for t in (tags or [])],
        owners=[SimpleNamespace(name=o) for o in (owners or [])],
        description=description,
        tableConstraints=constraints or [],
        schemaDefinition=schema_definition,
        deleted=deleted,
    )


def _column(name: str, data_type: DataType, *, tags: list[str] | None = None, description: str | None = None):
    return SimpleNamespace(
        name=name,
        dataType=data_type,
        tags=[SimpleNamespace(tagFQN=t) for t in (tags or [])],
        description=description,
    )


def _fk(column: str, ref_table: str, ref_column: str) -> SimpleNamespace:
    return SimpleNamespace(
        constraintType=ConstraintType.FOREIGN_KEY,
        columns=[column],
        referredColumns=[f"{ref_table}.{ref_column}"],
    )


FQN = "svc.default.e2e.customers"


# --------------------------------------------------------------------------- #
# TableAssert — entity-level terminals                                        #
# --------------------------------------------------------------------------- #


def test_exists_raises_when_entity_missing() -> None:
    fake = _FakeOM()
    # Nothing registered → get_by_name returns None → exists() raises.
    with pytest.raises(AssertionError, match=r"not found"):
        TableAssert(fake, FQN).exists()


def test_exists_passes_when_entity_present() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table())
    TableAssert(fake, FQN).exists()


def test_has_description_containing_passes_on_match() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(description="Customer records — primary table"))
    TableAssert(fake, FQN).has_description_containing("Customer records")


def test_has_description_containing_raises_on_mismatch() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(description="something else"))
    with pytest.raises(AssertionError, match=r"does not contain"):
        TableAssert(fake, FQN).has_description_containing("Customer records")


def test_has_tag_passes_on_match() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(tags=["PII.Sensitive"]))
    TableAssert(fake, FQN).has_tag("PII.Sensitive")


def test_has_tag_raises_when_tag_missing() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(tags=["Other.Tag"]))
    with pytest.raises(AssertionError, match=r"missing tag 'PII.Sensitive'"):
        TableAssert(fake, FQN).has_tag("PII.Sensitive")


def test_has_owner_passes_on_match() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(owners=["alice"]))
    TableAssert(fake, FQN).has_owner("alice")


def test_has_owner_raises_when_owner_missing() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(owners=["bob"]))
    with pytest.raises(AssertionError, match=r"missing owner 'alice'"):
        TableAssert(fake, FQN).has_owner("alice")


def test_has_foreign_key_passes_on_match() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(constraints=[_fk("customer_id", "customers", "id")]))
    TableAssert(fake, FQN).has_foreign_key_constraint("customer_id", "customers", "id")


def test_has_foreign_key_raises_when_constraint_absent() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(constraints=[]))
    with pytest.raises(AssertionError, match=r"missing FOREIGN_KEY"):
        TableAssert(fake, FQN).has_foreign_key_constraint("customer_id", "customers", "id")


def test_has_schema_definition_containing_is_case_insensitive() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(schema_definition="SELECT * FROM customers LEFT JOIN transactions"))
    # MySQL emits lowercase keywords — assertion's lower-cased substring match handles it.
    TableAssert(fake, FQN).has_schema_definition_containing("left join")


def test_has_schema_definition_containing_raises_on_mismatch() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(schema_definition="SELECT 1"))
    with pytest.raises(AssertionError, match=r"does not contain"):
        TableAssert(fake, FQN).has_schema_definition_containing("LEFT JOIN")


def test_is_soft_deleted_passes_when_deleted() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(deleted=True), include="all")
    TableAssert(fake, FQN).is_soft_deleted()


def test_is_soft_deleted_raises_when_alive() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(deleted=False), include="all")
    with pytest.raises(AssertionError, match=r"not soft-deleted"):
        TableAssert(fake, FQN).is_soft_deleted()


def test_is_not_deleted_passes_when_alive() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(deleted=False), include="all")
    TableAssert(fake, FQN).is_not_deleted()


def test_is_not_deleted_raises_when_soft_deleted() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(deleted=True), include="all")
    with pytest.raises(AssertionError, match=r"unexpectedly soft-deleted"):
        TableAssert(fake, FQN).is_not_deleted()


# --------------------------------------------------------------------------- #
# ColumnAssert — descended via TableAssert.column(name)                       #
# --------------------------------------------------------------------------- #


def test_column_has_type_passes_on_match() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(columns=[_column("id", DataType.BIGINT)]))
    TableAssert(fake, FQN).column("id").has_type(DataType.BIGINT)


def test_column_has_type_raises_on_mismatch() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(columns=[_column("id", DataType.INT)]))
    with pytest.raises(AssertionError, match=r"has type DataType.INT"):
        TableAssert(fake, FQN).column("id").has_type(DataType.BIGINT)


def test_column_lookup_raises_when_column_missing() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(columns=[_column("id", DataType.BIGINT)]))
    with pytest.raises(AssertionError, match=r"not found on table"):
        TableAssert(fake, FQN).column("missing").has_type(DataType.BIGINT)


def test_column_has_tag_passes_on_match() -> None:
    fake = _FakeOM()
    fake.register(
        Table,
        FQN,
        _table(columns=[_column("email", DataType.VARCHAR, tags=["PII.Sensitive"])]),
    )
    TableAssert(fake, FQN).column("email").has_tag("PII.Sensitive")


def test_column_has_tag_raises_when_missing() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(columns=[_column("email", DataType.VARCHAR)]))
    with pytest.raises(AssertionError, match=r"missing tag 'PII.Sensitive'"):
        TableAssert(fake, FQN).column("email").has_tag("PII.Sensitive")


def test_column_has_no_tag_raises_when_unexpectedly_present() -> None:
    """has_no_tag raises when the column carries a tag it should not have."""
    fake = _FakeOM()
    fake.register(
        Table,
        FQN,
        _table(columns=[_column("id", DataType.BIGINT, tags=["PII.Sensitive"])]),
    )
    with pytest.raises(AssertionError, match=r"unexpectedly carries tag 'PII.Sensitive'"):
        TableAssert(fake, FQN).column("id").has_no_tag("PII.Sensitive")


def test_column_has_no_tag_passes_when_absent() -> None:
    fake = _FakeOM()
    fake.register(Table, FQN, _table(columns=[_column("id", DataType.BIGINT)]))
    TableAssert(fake, FQN).column("id").has_no_tag("PII.Sensitive")


# --------------------------------------------------------------------------- #
# StoredProcedureAssert.has_code_containing                                   #
# --------------------------------------------------------------------------- #


def _sp(*, code: str | None) -> SimpleNamespace:
    return SimpleNamespace(
        storedProcedureCode=SimpleNamespace(code=code) if code is not None else None,
    )


def test_sp_has_code_containing_passes_on_match() -> None:
    fake = _FakeOM()
    fake.register(StoredProcedure, "svc.default.e2e.sp_count", _sp(code="SELECT COUNT(*) FROM customers"))
    StoredProcedureAssert(fake, "svc.default.e2e.sp_count").has_code_containing("SELECT COUNT(*)")


def test_sp_has_code_containing_raises_on_empty_body() -> None:
    """has_code_containing raises when stored procedure body is an empty string."""
    fake = _FakeOM()
    fake.register(StoredProcedure, "svc.default.e2e.sp_count", _sp(code=""))
    with pytest.raises(AssertionError, match=r"code does not contain 'SELECT COUNT"):
        StoredProcedureAssert(fake, "svc.default.e2e.sp_count").has_code_containing("SELECT COUNT(*)")


def test_sp_has_code_containing_raises_on_missing_body() -> None:
    fake = _FakeOM()
    fake.register(StoredProcedure, "svc.default.e2e.sp_count", _sp(code=None))
    with pytest.raises(AssertionError, match=r"code does not contain"):
        StoredProcedureAssert(fake, "svc.default.e2e.sp_count").has_code_containing("BEGIN")
