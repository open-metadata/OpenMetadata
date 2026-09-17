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
"""Meta-tests: verify StructuralDiffer detects each documented failure mode against a stub OM client."""

from __future__ import annotations

from dataclasses import replace
from types import SimpleNamespace
from typing import Any

import pytest
from sqlalchemy import Column as SqlColumn
from sqlalchemy import Integer, MetaData
from sqlalchemy import Table as SqlTable

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import Column, Constraint, DataType, Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)

from ..features.database.catalog.derive import derive_expected_service
from ..features.database.catalog.differ import StructuralMismatch, catalog_matches
from ..features.database.catalog.snapshot import read_catalog
from ..features.database.catalog.type_map import CORE_TYPE_MAP
from ..features.database.catalog.types import (
    DiffKind,
    ExpectedColumn,
    ExpectedDatabase,
    ExpectedSchema,
    ExpectedService,
    ExpectedStoredProcedure,
    ExpectedTable,
    MatchMode,
)

# --------------------------------------------------------------------------- #
# Stubs                                                                       #
# --------------------------------------------------------------------------- #


class _FakeOM:
    """Stub OpenMetadata client backed by pre-registered canned responses; unregistered lookups return None / []."""

    def __init__(self) -> None:
        self.entities: dict[tuple[type, str], Any] = {}
        self.listings: dict[tuple[type, str, str], list] = {}

    def register(self, entity_cls: type, fqn: str, value: Any) -> None:
        self.entities[(entity_cls, fqn)] = _entity(entity_cls, fqn, value)

    def register_list(self, entity_cls: type, parent_key: str, parent_value: str, items: list) -> None:
        self.listings[(entity_cls, parent_key, parent_value)] = [
            self.entities.get((entity_cls, f"{parent_value}.{item.name}"))
            or _entity(entity_cls, f"{parent_value}.{item.name}", item)
            for item in items
        ]

    # --- OpenMetadata API surface used by the differ -----------------------

    def get_by_name(self, *, entity, fqn, fields=None, include=None):
        return self.entities.get((entity, fqn))

    def list_all_entities(self, *, entity, params, fields=None, limit=1000):
        (parent_key, parent_value) = next(iter(params.items()))
        return self.listings.get(
            (entity, parent_key, parent_value),
            [
                value
                for (kind, fqn), value in self.entities.items()
                if kind is entity and value is not None and fqn.rsplit(".", 1)[0] == parent_value
            ],
        )


def _entity(entity_cls, fqn, value):
    from uuid import NAMESPACE_DNS, uuid5

    parts = fqn.split(".")

    def ref(name, kind):
        return {"id": str(uuid5(NAMESPACE_DNS, name)), "type": kind, "fullyQualifiedName": name}

    data = {
        "id": str(uuid5(NAMESPACE_DNS, fqn)),
        "name": parts[-1],
        "fullyQualifiedName": fqn,
        "service": ref(parts[0], "databaseService"),
        "database": ref(".".join(parts[:2]), "database"),
        "databaseSchema": ref(".".join(parts[:3]), "databaseSchema"),
        "serviceType": DatabaseServiceType.Mysql,
        "storedProcedureCode": {"language": "SQL", "code": "SELECT 1"},
        **vars(value),
    }
    return entity_cls(**{key: val for key, val in data.items() if key in entity_cls.model_fields})


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


def _column(name: str, data_type: DataType, **extra: Any) -> Column:
    return Column(name=name, dataType=data_type, **extra)


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


def assert_service_matches(expected, fake, *, mode=MatchMode.SUPERSET):
    catalog_matches(expected, mode=mode)(read_catalog(fake, expected.name))


# --------------------------------------------------------------------------- #
# Happy path — the differ should NOT raise when OM matches Expected.          #
# --------------------------------------------------------------------------- #


def test_happy_path_no_diffs() -> None:
    expected = _baseline_expected()
    fake = _FakeOM()
    _seed_happy_path(fake, expected)
    assert_service_matches(expected, fake)


@pytest.mark.parametrize("wrong_constraint", [Constraint.NOT_NULL, None])
def test_derived_nullable_column_requires_explicit_null_constraint(wrong_constraint):
    metadata = MetaData(schema="e2e")
    SqlTable(
        "customers",
        metadata,
        SqlColumn("id", Integer, primary_key=True),
        SqlColumn("required_value", Integer, nullable=False),
        SqlColumn("optional_value", Integer, nullable=True),
    )
    expected = derive_expected_service(
        service_name="svc", service_type=DatabaseServiceType.Mysql, metadata=metadata, type_map=CORE_TYPE_MAP
    )
    fake = _FakeOM()
    _seed_happy_path(fake, expected)
    _patch_table(
        fake,
        f"{SCHEMA_FQN}.customers",
        columns=[
            _column("id", DataType.INT, constraint=Constraint.PRIMARY_KEY),
            _column("required_value", DataType.INT, constraint=Constraint.NOT_NULL),
            _column("optional_value", DataType.INT, constraint=Constraint.NULL),
        ],
    )
    assert_service_matches(expected, fake, mode=MatchMode.STRICT)
    fake.entities[(Table, f"{SCHEMA_FQN}.customers")].columns[2].constraint = wrong_constraint
    with pytest.raises(StructuralMismatch, match=r"column\[optional_value\].constraint"):
        assert_service_matches(expected, fake, mode=MatchMode.STRICT)


def test_handwritten_unspecified_constraint_remains_unchecked():
    expected = _baseline_expected()
    fake = _FakeOM()
    _seed_happy_path(fake, expected)
    fake.entities[(Table, f"{SCHEMA_FQN}.customers")].columns[0].constraint = Constraint.NOT_NULL
    assert_service_matches(expected, fake, mode=MatchMode.STRICT)


@pytest.mark.parametrize("collection", ["databases", "schemas", "tables", "procedures"])
def test_strict_rejects_duplicate_entity_fqns(collection):
    expected = _baseline_expected()
    fake = _FakeOM()
    _seed_happy_path(fake, expected)
    snapshot = read_catalog(fake, expected.name)
    check = catalog_matches(expected, mode=MatchMode.STRICT)
    check(snapshot)
    entities = getattr(snapshot, collection)
    corrupted = replace(snapshot, **{collection: (*entities, entities[0].model_copy(deep=True))})
    with pytest.raises(StructuralMismatch, match="duplicates") as raised:
        check(corrupted)
    assert entities[0].fullyQualifiedName.root in str(raised.value)


@pytest.mark.parametrize("corruption", ["identical", "wrong-first", "wrong-last"])
def test_strict_rejects_duplicate_column_names_before_lookup(corruption):
    expected = _baseline_expected()
    fake = _FakeOM()
    _seed_happy_path(fake, expected)
    table = fake.entities[(Table, f"{SCHEMA_FQN}.customers")]
    duplicate = table.columns[0].model_copy(deep=True)
    if corruption != "identical":
        duplicate.dataType = DataType.INT
    if corruption == "wrong-first":
        table.columns.insert(0, duplicate)
    else:
        table.columns.append(duplicate)
    with pytest.raises(StructuralMismatch, match=r"column\[id\].duplicates"):
        assert_service_matches(expected, fake, mode=MatchMode.STRICT)


def test_strict_allows_same_local_names_in_different_parents():
    expected = _baseline_expected()
    expected.databases.append(replace(expected.databases[0], name="another_database"))
    fake = _FakeOM()
    _seed_happy_path(fake, expected)
    assert_service_matches(expected, fake, mode=MatchMode.STRICT)


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
        assert_service_matches(expected, fake)

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
    fake.register(
        Table,
        f"{SCHEMA_FQN}.customers",
        _stub(
            name="customers",
            columns=[_column("email", DataType.VARCHAR)],
        ),
    )

    with pytest.raises(StructuralMismatch, match=r"column\[email\].tags"):
        assert_service_matches(expected, fake)


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
        assert_service_matches(expected, fake)


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
        assert_service_matches(expected, fake)


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
    assert_service_matches(expected, fake, mode=MatchMode.SUPERSET)

    # STRICT flags it.
    with pytest.raises(StructuralMismatch, match=r"phantom"):
        assert_service_matches(expected, fake, mode=MatchMode.STRICT)


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

    assert_service_matches(expected, fake, mode=MatchMode.SUPERSET)

    with pytest.raises(StructuralMismatch, match=r"phantom"):
        assert_service_matches(expected, fake, mode=MatchMode.STRICT)


@pytest.mark.parametrize(
    "entity,fqn",
    [
        (Database, "svc.extra"),
        (DatabaseSchema, "svc.default.extra"),
        (StoredProcedure, "svc.default.e2e.extra"),
    ],
)
def test_strict_detects_extra_entities_at_each_parent(entity, fqn):
    fake = _FakeOM()
    expected = _baseline_expected()
    _seed_happy_path(fake, expected)
    fake.register(entity, fqn, _stub(name="extra"))
    snapshot = read_catalog(fake, "svc")
    catalog_matches(expected, mode=MatchMode.SUPERSET)(snapshot)
    with pytest.raises(StructuralMismatch, match="extra") as raised:
        catalog_matches(expected, mode=MatchMode.STRICT)(snapshot)
    assert any(diff.kind is DiffKind.UNEXPECTED for diff in raised.value.diffs)


def test_same_named_table_in_another_schema_does_not_satisfy_expected():
    fake = _FakeOM()
    _seed_happy_path(fake, _baseline_expected())
    _drop(fake, Table, "svc.default.e2e.customers")
    fake.register(DatabaseSchema, "svc.default.other", _stub(name="other"))
    fake.register(
        Table, "svc.default.other.customers", _stub(name="customers", columns=[_column("id", DataType.BIGINT)])
    )
    with pytest.raises(StructuralMismatch, match=r"table\[customers\]: missing"):
        catalog_matches(_baseline_expected(), mode=MatchMode.SUPERSET)(read_catalog(fake, "svc"))


@pytest.mark.parametrize(
    "collection,parent_field",
    [
        ("databases", "service"),
        ("schemas", "database"),
        ("tables", "databaseSchema"),
        ("procedures", "databaseSchema"),
    ],
)
@pytest.mark.parametrize("corruption", ["fqn", "id", "missing_parent_fqn"])
def test_strict_rejects_expected_entity_with_inconsistent_parent(collection, parent_field, corruption):
    fake = _FakeOM()
    expected = _baseline_expected()
    _seed_happy_path(fake, expected)
    snapshot = read_catalog(fake, "svc")
    catalog_matches(expected, mode=MatchMode.STRICT)(snapshot)
    entities = getattr(snapshot, collection)
    payload = entities[0].model_dump(mode="json")
    if corruption == "id":
        payload[parent_field]["id"] = "00000000-0000-0000-0000-000000000001"
    else:
        payload[parent_field]["fullyQualifiedName"] = "undeclared" if corruption == "fqn" else None
    changed = type(entities[0]).model_validate(payload)
    snapshot = replace(snapshot, **{collection: (changed, *entities[1:])})

    with pytest.raises(StructuralMismatch, match=parent_field):
        catalog_matches(expected, mode=MatchMode.STRICT)(snapshot)


@pytest.mark.parametrize(
    "collection,parent_field",
    [
        ("databases", "service"),
        ("schemas", "database"),
        ("tables", "databaseSchema"),
        ("procedures", "databaseSchema"),
    ],
)
@pytest.mark.parametrize("corruption", ["undeclared_parent", "missing_fqn"])
def test_strict_checks_complete_inventory_including_unattached_entities(collection, parent_field, corruption):
    fake = _FakeOM()
    expected = _baseline_expected()
    _seed_happy_path(fake, expected)
    snapshot = read_catalog(fake, "svc")
    entities = getattr(snapshot, collection)
    payload = entities[0].model_dump(mode="json")
    payload["id"] = "00000000-0000-0000-0000-000000000001"
    if corruption == "undeclared_parent":
        payload["fullyQualifiedName"] = "undeclared." + payload["name"]
        payload[parent_field]["fullyQualifiedName"] = "undeclared"
    else:
        payload["fullyQualifiedName"] = None
    extra = type(entities[0]).model_validate(payload)
    snapshot = replace(snapshot, **{collection: (*entities, extra)})

    catalog_matches(expected, mode=MatchMode.SUPERSET)(snapshot)
    with pytest.raises(StructuralMismatch):
        catalog_matches(expected, mode=MatchMode.STRICT)(snapshot)


@pytest.mark.parametrize("mode", [MatchMode.STRICT, MatchMode.SUPERSET])
def test_catalog_uses_canonical_quoted_identifiers_at_every_level(mode):
    fake = _FakeOM()
    _seed_happy_path(fake, _baseline_expected())
    snapshot = read_catalog(fake, "svc")
    expected = ExpectedService(
        name="svc.prod",
        service_type=DatabaseServiceType.Mysql,
        databases=[
            ExpectedDatabase(
                name="db.prod",
                schemas=[
                    ExpectedSchema(
                        name="schema.prod",
                        tables=[
                            ExpectedTable(
                                "orders.archive",
                                columns=[
                                    ExpectedColumn("id", DataType.BIGINT),
                                    ExpectedColumn("email", DataType.VARCHAR),
                                ],
                            ),
                            ExpectedTable("transactions", columns=[ExpectedColumn("id", DataType.BIGINT)]),
                        ],
                        stored_procedures=[ExpectedStoredProcedure("count.orders")],
                    )
                ],
            )
        ],
    )
    identities = {
        "svc": ("svc.prod", '"svc.prod"'),
        "svc.default": ("db.prod", '"svc.prod"."db.prod"'),
        "svc.default.e2e": ("schema.prod", '"svc.prod"."db.prod"."schema.prod"'),
        "svc.default.e2e.customers": ("orders.archive", '"svc.prod"."db.prod"."schema.prod"."orders.archive"'),
        "svc.default.e2e.transactions": ("transactions", '"svc.prod"."db.prod"."schema.prod".transactions'),
        "svc.default.e2e.sp_count": ("count.orders", '"svc.prod"."db.prod"."schema.prod"."count.orders"'),
    }

    def rename(entity):
        payload = entity.model_dump(mode="json")
        payload["name"], payload["fullyQualifiedName"] = identities[payload["fullyQualifiedName"]]
        for field in ("service", "database", "databaseSchema"):
            if payload.get(field):
                payload[field]["fullyQualifiedName"] = identities[payload[field]["fullyQualifiedName"]][1]
        return type(entity).model_validate(payload)

    snapshot = replace(
        snapshot,
        service=rename(snapshot.service),
        **{
            collection: tuple(rename(entity) for entity in getattr(snapshot, collection))
            for collection in ("databases", "schemas", "tables", "procedures")
        },
    )
    catalog_matches(expected, mode=mode)(snapshot)

    payload = snapshot.tables[0].model_dump(mode="json")
    payload["fullyQualifiedName"] = '"svc.prod"."db.prod"."schema.prod".orders.archive'
    malformed = Table.model_validate(payload)
    with pytest.raises(StructuralMismatch, match=r"table\[orders.archive\]: missing"):
        catalog_matches(expected, mode=mode)(replace(snapshot, tables=(malformed, snapshot.tables[1])))


def test_catalog_reader_quotes_dotted_service_name():
    fake = _FakeOM()
    fake.register(DatabaseService, '"svc.prod"', _stub(name="svc.prod"))
    service = fake.entities[(DatabaseService, '"svc.prod"')]
    fake.register(
        Database,
        '"svc.prod".default',
        _stub(service={"id": service.id, "type": "databaseService", "fullyQualifiedName": '"svc.prod"'}),
    )

    snapshot = read_catalog(fake, "svc.prod")

    assert snapshot.service == service
    assert [database.fullyQualifiedName.root for database in snapshot.databases] == ['"svc.prod".default']


def test_catalog_reader_uses_sdk_pagination_parent_scope_and_requested_fields():
    from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
        OpenMetadataConnection,
    )
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

    fake = _FakeOM()
    _seed_happy_path(fake, _baseline_expected())

    def payload(entity, fqn):
        return fake.entities[(entity, fqn)].model_dump(mode="json", exclude_none=True)

    def get(path, data=None):
        if path == "/services/databaseServices/name/svc":
            assert data is None
            return payload(DatabaseService, "svc")
        routes = {
            "/databases?limit=1000": ({"service": "svc"}, [payload(Database, "svc.default")], {}),
            "/databaseSchemas?limit=1000": (
                {"database": "svc.default"},
                [payload(DatabaseSchema, "svc.default.e2e")],
                {},
            ),
            "/tables?limit=1000&fields=tags,owners,columns": (
                {"databaseSchema": "svc.default.e2e"},
                [payload(Table, "svc.default.e2e.customers")],
                {"after": "next-page"},
            ),
            "/tables?limit=1000&after=next-page&fields=tags,owners,columns": (
                {"databaseSchema": "svc.default.e2e"},
                [payload(Table, "svc.default.e2e.transactions")],
                {},
            ),
            "/storedProcedures?limit=1000": (
                {"databaseSchema": "svc.default.e2e"},
                [payload(StoredProcedure, "svc.default.e2e.sp_count")],
                {},
            ),
        }
        scope, entities, paging = routes[path]
        assert data == scope
        return {"data": entities, "paging": {"total": len(entities), **paging}}

    om = OpenMetadata(
        OpenMetadataConnection(
            hostPort="http://127.0.0.1:9/api",
            authProvider="openmetadata",
            securityConfig={"jwtToken": "placeholder"},
            enableVersionValidation=False,
        )
    )
    om.client = SimpleNamespace(get=get)
    snapshot = read_catalog(om, "svc")
    assert [table.name.root for table in snapshot.tables] == ["customers", "transactions"]
    catalog_matches(_baseline_expected(), mode=MatchMode.STRICT)(snapshot)
