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
"""Pure persisted-state checks specific to the Redshift fixture."""

from __future__ import annotations

import time
from collections import Counter
from typing import TYPE_CHECKING

from metadata.generated.schema.entity.data.table import ConstraintType, SystemProfile
from metadata.ingestion.ometa.utils import model_str

from ..features.database.entities import entity_exists, procedure_has_code
from ..runtime.expect import Query
from .baseline import (
    ACTIVE_CUSTOMER_PROCEDURE,
    DIST_KEY_COLUMN,
    NATIVE_COLUMN_NAMES,
    NATIVE_INTEGER_COLUMN,
    NATIVE_INTEGER_VALUE,
    SORT_KEY_COLUMN,
)

if TYPE_CHECKING:
    from metadata.generated.schema.entity.data.table import DmlOperationType

_MAX_PROFILE_PAGES = 20

NATIVE_SAMPLE_VALUES = {
    "id": 1,
    "smallint_col": 32767,
    "bigint_col": 9000000000,
    "real_col": 1.5,
    "double_col": 1234.5678,
    "bool_col": True,
    "char_col": "abcdefghij",
    "varchar_col": "text value",
    SORT_KEY_COLUMN: "2026-01-02",
    "timestamp_col": "2026-01-02T12:34:56",
    "super_col": {"kind": "fixture", "count": 2},
    # FROM_HEX('616263'): the bytes of "abc", which psycopg2 hands over as hex text.
    "varbyte_col": "abc",
}


def procedure_has_body(snapshot):
    """The owned procedure's body survives ingestion, read off the catalog snapshot."""
    procedure = next(
        (item for item in snapshot.procedures if model_str(item.name) == ACTIVE_CUSTOMER_PROCEDURE),
        None,
    )
    procedure_has_code("COUNT(*) FROM")(procedure)


def table_has_dist_and_sort_keys(table):
    """DISTKEY and SORTKEY land as table constraints on exactly the declared columns."""
    entity_exists(table)
    constraints = {
        (constraint.constraintType, tuple(constraint.columns or ()))
        for constraint in table.tableConstraints or []
        if constraint.constraintType in (ConstraintType.DIST_KEY, ConstraintType.SORT_KEY)
    }
    expected = {(ConstraintType.DIST_KEY, (DIST_KEY_COLUMN,)), (ConstraintType.SORT_KEY, (SORT_KEY_COLUMN,))}
    assert constraints == expected, f"dist/sort keys: expected {expected!r}, got {constraints!r}"


def native_sample_rows(table):
    """Return the persisted sample of the native table as one {column: value} row."""
    entity_exists(table)
    fqn = model_str(table.fullyQualifiedName)
    assert table.sampleData is not None, f"{fqn}: sample data missing"
    names = [model_str(name) for name in table.sampleData.columns]
    assert len(names) == len(NATIVE_COLUMN_NAMES), f"{fqn}: sample column count {len(names)}"
    assert set(names) == set(NATIVE_COLUMN_NAMES), f"{fqn}: sample columns {names!r}"
    rows = table.sampleData.rows
    assert len(rows) == 1, f"{fqn}: expected one sample row, got {len(rows)}"
    assert len(rows[0]) == len(names), f"{fqn}: sample row width {len(rows[0])}"
    return dict(zip(names, rows[0], strict=True))


def native_samples_match(table, *, integer_value: int = NATIVE_INTEGER_VALUE):
    row = native_sample_rows(table)
    for name, expected in {**NATIVE_SAMPLE_VALUES, NATIVE_INTEGER_COLUMN: integer_value}.items():
        assert row[name] == expected, f"{name} sample: expected {expected!r}, got {row[name]!r}"


def sample_row_count(expected: int):
    def check(table):
        entity_exists(table)
        assert table.sampleData is not None, "sample data missing"
        actual = len(table.sampleData.rows)
        assert actual == expected, f"sample rows: expected {expected}, got {actual}"

    return check


def system_profile_query(om, fqn: str, *, since_ms: int) -> Query[list[SystemProfile]]:
    def read():
        until_ms = int(time.time() * 1000) + 60_000
        profiles, after = [], None
        for _ in range(_MAX_PROFILE_PAGES):
            page = om.get_profile_data(fqn, since_ms, until_ms, limit=100, after=after, profile_type=SystemProfile)
            profiles.extend(page.entities)
            after = page.after
            if not after or not page.entities or len(profiles) >= page.total:
                return profiles
        raise RuntimeError(f"system profile for {fqn} exceeded {_MAX_PROFILE_PAGES} pages")

    return Query(f"system profile for {fqn}", read)


def system_profile_matches(expected: list[tuple[DmlOperationType, int]]):
    """Exact multiset of (operation, rowsAffected): other tables' DML must not be attributed here."""
    if not expected:
        raise ValueError("expected system profile must not be empty")
    wanted = Counter(expected)

    def check(profiles):
        actual = Counter((profile.operation, profile.rowsAffected) for profile in profiles)
        assert actual == wanted, f"system profile: expected {dict(wanted)!r}, got {dict(actual)!r}"

    return check
