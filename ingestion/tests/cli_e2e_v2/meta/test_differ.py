#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Meta-tests: verify StructuralDiffer detects each documented failure mode against a stub OM client."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import DataType, Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)

from ..core.expected.differ import StructuralMismatch, assert_service_matches
from ..core.expected.types import (
    ExpectedColumn,
    ExpectedDatabase,
    ExpectedSchema,
    ExpectedService,
    ExpectedStoredProcedure,
    ExpectedTable,
    MatchMode,
)
from ..core.fluent.om_client import OmClient
from ..core.source.types import DiffKind

# --------------------------------------------------------------------------- #
# Stubs                                                                       #
# --------------------------------------------------------------------------- #


class _FakeOM:
    """Stub OpenMetadata client backed by pre-registered canned responses; unregistered lookups return None / []."""

    def __init__(self) -> None:
        self.entities: dict[tuple[type, str], Any] = {}
        self.listings: dict[tuple[type, str, str], list] = {}

    def register(self, entity_cls: type, fqn: str, value: Any) -> None:
        self.entities[(entity_cls, fqn)] = value

    def register_list(self, entity_cls: type, parent_key: str, parent_value: str, items: list) -> None:
        self.listings[(entity_cls, parent_key, parent_value)] = items

    # --- OpenMetadata API surface used by the differ -----------------------

    def get_by_name(self, *, entity, fqn, fields=None, include=None):
        return self.entities.get((entity, fqn))

    def list_all_entities(self, *, entity, params, limit=1000):
        (parent_key, parent_value) = next(iter(params.items()))
        return self.listings.get((entity, parent_key, parent_value), [])


def _stub(**kwargs: Any) -> SimpleNamespace:
    """Build a SimpleNamespace with differ-required defaults overridden by kwargs."""
    defaults = {
        "tags": [],
        "owners": [],
        "columns": [],
        "description": None,
        "deleted": False,
    }
    return SimpleNamespace(**{**defaults, **kwargs})


def _column(name: str, data_type: DataType, **extra: Any) -> SimpleNamespace:
    return _stub(name=name, dataType=data_type, constraint=None, **extra)


SERVICE_FQN = "svc"
DB_FQN = "svc.default"
SCHEMA_FQN = "svc.default.e2e"


def _seed_happy_path(fake: _FakeOM, expected: ExpectedService) -> None:
    """Register OM responses that exactly match `expected`; negative tests overwrite one entry to inject a discrepancy."""
    fake.register(DatabaseService, expected.name, _stub(serviceType=expected.service_type))
    for db in expected.databases:
        db_fqn = f"{expected.name}.{db.name}"
        fake.register(Database, db_fqn, _stub(name=db.name))
        for schema in db.schemas:
            schema_fqn = f"{db_fqn}.{schema.name}"
            fake.register(DatabaseSchema, schema_fqn, _stub(name=schema.name))
            for table in schema.tables:
                fake.register(
                    Table,
                    f"{schema_fqn}.{table.name}",
                    _stub(
                        name=table.name,
                        columns=[_column(c.name, c.data_type) for c in table.columns],
                    ),
                )
            for sp in schema.stored_procedures:
                fake.register(StoredProcedure, f"{schema_fqn}.{sp.name}", _stub(name=sp.name))


def _baseline_expected() -> ExpectedService:
    """Return the canonical ExpectedService tree used by negative tests."""
    return ExpectedService(
        name="svc",
        service_type=DatabaseServiceType.Mysql,
        databases=[
            ExpectedDatabase(
                name="default",
                schemas=[
                    ExpectedSchema(
                        name="e2e",
                        tables=[
                            ExpectedTable(
                                name="customers",
                                columns=[
                                    ExpectedColumn("id", DataType.BIGINT),
                                    ExpectedColumn("email", DataType.VARCHAR),
                                ],
                            ),
                            ExpectedTable(
                                name="transactions",
                                columns=[ExpectedColumn("id", DataType.BIGINT)],
                            ),
                        ],
                        stored_procedures=[ExpectedStoredProcedure("sp_count")],
                    )
                ],
            )
        ],
    )


def _client(fake: _FakeOM) -> OmClient:
    return OmClient(fake)  # type: ignore[arg-type]


# --------------------------------------------------------------------------- #
# Happy path — the differ should NOT raise when OM matches Expected.          #
# --------------------------------------------------------------------------- #


def test_happy_path_no_diffs() -> None:
    expected = _baseline_expected()
    fake = _FakeOM()
    _seed_happy_path(fake, expected)
    assert_service_matches(expected, _client(fake))


# --------------------------------------------------------------------------- #
# Each parametrize row injects ONE corruption and asserts it is caught.       #
# `mutate(fake)` mutates the registered actuals; the Expected tree stays the  #
# canonical baseline. `expected_path_fragment` is a substring search against  #
# the rendered StructuralMismatch — looser than DiffKind matching but reads   #
# closer to the failure message a developer would actually see.               #
# --------------------------------------------------------------------------- #


def _drop(fake: _FakeOM, entity_cls: type, fqn: str) -> None:
    fake.entities[(entity_cls, fqn)] = None


def _patch_table(fake: _FakeOM, fqn: str, **kwargs: Any) -> None:
    table = fake.entities[(Table, fqn)]
    for k, v in kwargs.items():
        setattr(table, k, v)


@pytest.mark.parametrize(
    "label,mutate,expected_kind,path_fragment",
    [
        (
            "missing_service",
            lambda fake: _drop(fake, DatabaseService, SERVICE_FQN),
            DiffKind.MISSING,
            "service[svc]",
        ),
        (
            "missing_database",
            lambda fake: _drop(fake, Database, DB_FQN),
            DiffKind.MISSING,
            "database[default]",
        ),
        (
            "missing_schema",
            lambda fake: _drop(fake, DatabaseSchema, SCHEMA_FQN),
            DiffKind.MISSING,
            "schema[e2e]",
        ),
        (
            "missing_table",
            lambda fake: _drop(fake, Table, f"{SCHEMA_FQN}.customers"),
            DiffKind.MISSING,
            "table[customers]",
        ),
        (
            "missing_stored_procedure",
            lambda fake: _drop(fake, StoredProcedure, f"{SCHEMA_FQN}.sp_count"),
            DiffKind.MISSING,
            "procedure[sp_count]",
        ),
        (
            "missing_column",
            lambda fake: _patch_table(
                fake,
                f"{SCHEMA_FQN}.customers",
                columns=[_column("id", DataType.BIGINT)],
            ),
            DiffKind.MISSING,
            "column[email]",
        ),
        (
            "wrong_column_type",
            lambda fake: _patch_table(
                fake,
                f"{SCHEMA_FQN}.customers",
                columns=[_column("id", DataType.INT), _column("email", DataType.VARCHAR)],
            ),
            DiffKind.VALUE_MISMATCH,
            "column[id].dataType",
        ),
        (
            "wrong_service_type",
            lambda fake: setattr(
                fake.entities[(DatabaseService, SERVICE_FQN)],
                "serviceType",
                DatabaseServiceType.Postgres,
            ),
            DiffKind.VALUE_MISMATCH,
            "service[svc].serviceType",
        ),
    ],
    ids=lambda v: v if isinstance(v, str) else "",
)
def test_diff_detected(label, mutate, expected_kind, path_fragment) -> None:
    expected = _baseline_expected()
    fake = _FakeOM()
    _seed_happy_path(fake, expected)
    mutate(fake)

    with pytest.raises(StructuralMismatch) as exc_info:
        assert_service_matches(expected, _client(fake))

    diffs = exc_info.value.diffs
    assert any(d.kind is expected_kind and path_fragment in d.path for d in diffs), (
        f"expected a {expected_kind.name} diff containing {path_fragment!r}; got: {diffs!r}"
    )


# --------------------------------------------------------------------------- #
# Field-level assertions that don't fit the parametrize matrix cleanly        #
# (each needs additional setup: tags, descriptions, owners).                  #
# --------------------------------------------------------------------------- #


def test_missing_column_tag() -> None:
    expected = ExpectedService(
        name="svc",
        service_type=DatabaseServiceType.Mysql,
        databases=[
            ExpectedDatabase(
                name="default",
                schemas=[
                    ExpectedSchema(
                        name="e2e",
                        tables=[
                            ExpectedTable(
                                name="customers",
                                columns=[
                                    ExpectedColumn(
                                        "email",
                                        DataType.VARCHAR,
                                        tags=frozenset({"PII.Sensitive"}),
                                    ),
                                ],
                            )
                        ],
                    )
                ],
            )
        ],
    )
    fake = _FakeOM()
    _seed_happy_path(fake, expected)
    # Overwrite the auto-seeded column to drop the tag.
    fake.entities[(Table, f"{SCHEMA_FQN}.customers")] = _stub(
        name="customers",
        columns=[_stub(name="email", dataType=DataType.VARCHAR, constraint=None, tags=[])],
    )

    with pytest.raises(StructuralMismatch, match=r"column\[email\].tags"):
        assert_service_matches(expected, _client(fake))


def test_missing_table_description() -> None:
    expected = _baseline_expected()
    expected = ExpectedService(
        name=expected.name,
        service_type=expected.service_type,
        databases=[
            ExpectedDatabase(
                name="default",
                schemas=[
                    ExpectedSchema(
                        name="e2e",
                        tables=[
                            ExpectedTable(
                                name="customers",
                                columns=[ExpectedColumn("id", DataType.BIGINT)],
                                description="Customer records",
                            )
                        ],
                    )
                ],
            )
        ],
    )
    fake = _FakeOM()
    _seed_happy_path(fake, expected)
    _patch_table(fake, f"{SCHEMA_FQN}.customers", description="other text")

    with pytest.raises(StructuralMismatch, match=r"table\[customers\].description"):
        assert_service_matches(expected, _client(fake))


def test_missing_owner() -> None:
    expected = ExpectedService(
        name="svc",
        service_type=DatabaseServiceType.Mysql,
        databases=[
            ExpectedDatabase(
                name="default",
                schemas=[
                    ExpectedSchema(
                        name="e2e",
                        tables=[
                            ExpectedTable(
                                name="customers",
                                columns=[ExpectedColumn("id", DataType.BIGINT)],
                                owner="alice",
                            )
                        ],
                    )
                ],
            )
        ],
    )
    fake = _FakeOM()
    _seed_happy_path(fake, expected)
    # Default seeded owners is []; assertion requires "alice" → diff fires.

    with pytest.raises(StructuralMismatch, match=r"table\[customers\].owner"):
        assert_service_matches(expected, _client(fake))


# --------------------------------------------------------------------------- #
# STRICT mode catches extras that SUPERSET tolerates.                         #
# --------------------------------------------------------------------------- #


def test_strict_flags_extra_table_unexpected() -> None:
    expected = _baseline_expected()
    fake = _FakeOM()
    _seed_happy_path(fake, expected)
    fake.register_list(
        Table,
        "databaseSchema",
        SCHEMA_FQN,
        [
            _stub(name="customers"),
            _stub(name="transactions"),
            _stub(name="phantom"),
        ],
    )

    # SUPERSET tolerates the extra.
    assert_service_matches(expected, _client(fake), mode=MatchMode.SUPERSET)

    # STRICT flags it.
    with pytest.raises(StructuralMismatch, match=r"phantom"):
        assert_service_matches(expected, _client(fake), mode=MatchMode.STRICT)


def test_strict_flags_extra_column() -> None:
    expected = _baseline_expected()
    fake = _FakeOM()
    _seed_happy_path(fake, expected)
    _patch_table(
        fake,
        f"{SCHEMA_FQN}.customers",
        columns=[
            _column("id", DataType.BIGINT),
            _column("email", DataType.VARCHAR),
            _column("phantom", DataType.VARCHAR),
        ],
    )

    assert_service_matches(expected, _client(fake), mode=MatchMode.SUPERSET)

    with pytest.raises(StructuralMismatch, match=r"phantom"):
        assert_service_matches(expected, _client(fake), mode=MatchMode.STRICT)
