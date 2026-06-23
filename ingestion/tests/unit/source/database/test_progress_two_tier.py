#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
from metadata.ingestion.source.database.progress_two_tier import to_two_tier
from metadata.utils.progress_registry import ProgressNodeSnapshot


def _schema(db, name, table, sp=None):
    children = ()
    expected_by_type = {"Table": table[1]}
    processed_by_type = {"Table": table[0]}
    if sp is not None:
        expected_by_type["StoredProcedure"] = sp[1]
        processed_by_type["StoredProcedure"] = sp[0]
    return ProgressNodeSnapshot(
        label=name,
        child_type="Table",
        expected=None,
        processed=0,
        active=True,
        overflow=0,
        children=children,
        expected_by_type=expected_by_type,
        processed_by_type=processed_by_type,
    )


def _db(name, schemas):
    return ProgressNodeSnapshot(
        label=name,
        child_type="DatabaseSchema",
        expected=None,
        processed=0,
        active=True,
        overflow=0,
        children=tuple(schemas),
        expected_by_type={"DatabaseSchema": len(schemas)},
        processed_by_type={},
    )


def _generic(dbs, db_processed):
    return ProgressNodeSnapshot(
        label="",
        child_type="Database",
        expected=5,
        processed=db_processed,
        active=True,
        overflow=0,
        children=tuple(dbs),
        expected_by_type={"Database": 5},
        processed_by_type={},
    )


def test_two_tier_builds_global_headers_and_split_leaves():
    generic = _generic([_db("analytics", [_schema("analytics", "public", (12, 47), (0, 3))])], db_processed=2)
    root = to_two_tier(generic, schemas_processed=40, global_expected={"DatabaseSchema": 350}, active_schema_cap=20)
    assert (root.child_type, root.processed, root.expected) == ("Database", 2, 5)
    rollup = root.children[0]
    assert (rollup.child_type, rollup.processed, rollup.expected) == ("DatabaseSchema", 40, 350)
    schema = rollup.children[0]
    assert schema.label == "analytics.public"
    assert schema.child_type is None
    leaves = {c.child_type: (c.processed, c.expected) for c in schema.children}
    assert leaves == {"Table": (12, 47), "StoredProcedure": (0, 3)}


def test_two_tier_caps_active_schemas_and_reports_overflow():
    schemas = [_schema("db", f"s{i}", (1, 9)) for i in range(5)]
    generic = _generic([_db("db", schemas)], db_processed=0)
    root = to_two_tier(generic, schemas_processed=0, global_expected={"DatabaseSchema": 100}, active_schema_cap=2)
    rollup = root.children[0]
    assert len(rollup.children) == 2
    assert rollup.overflow == 3


def test_two_tier_none_when_generic_is_none():
    assert to_two_tier(None, 0, {}) is None


def test_two_tier_appends_completed_schemas_marked_done():
    generic = _generic([_db("analytics", [_schema("analytics", "public", (12, 47))])], db_processed=1)
    completed = [(("sales",), _schema("sales", "orders", (47, 47), (3, 3)))]
    root = to_two_tier(generic, schemas_processed=40, global_expected={"DatabaseSchema": 350}, completed=completed)
    rollup = root.children[0]
    by_label = {child.label: child for child in rollup.children}
    assert by_label["analytics.public"].active is True  # in-flight first
    done = by_label["sales.orders"]
    assert done.active is False
    assert done.child_type is None
    leaves = {c.child_type: (c.processed, c.expected, c.active) for c in done.children}
    assert leaves == {"Table": (47, 47, False), "StoredProcedure": (3, 3, False)}


def test_two_tier_caps_completed_schemas():
    completed = [(("d",), _schema("d", f"s{i}", (1, 1))) for i in range(30)]
    generic = _generic([], db_processed=30)
    root = to_two_tier(
        generic,
        schemas_processed=30,
        global_expected={"DatabaseSchema": 30},
        completed=completed,
        completed_schema_cap=5,
    )
    rollup = root.children[0]
    assert len(rollup.children) == 5  # bounded completed tail, no active schemas
