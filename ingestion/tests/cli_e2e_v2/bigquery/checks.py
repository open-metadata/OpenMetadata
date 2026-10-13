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
"""Pure BigQuery fixture-specific persisted-state checks and queries."""

from __future__ import annotations

import json
import time
from collections import Counter
from typing import TYPE_CHECKING

from metadata.generated.schema.entity.data.table import (
    DmlOperationType,
    PartitionIntervalTypes,
    SystemProfile,
    Table,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.utils import model_str

from ..features.database.entities import entity_exists, procedure_has_code
from ..runtime.expect import Query

_MAX_PROFILE_PAGES = 20
# testDefinition and testSuite are required by the generated TestCase model.
_TEST_CASE_FIELDS = ["testDefinition", "testSuite", "testCaseResult"]

if TYPE_CHECKING:
    from metadata.generated.schema.tests.basic import TestCaseStatus


def procedures_have_bodies(snapshot):
    procedure = next((item for item in snapshot.procedures if item.name.root == "sp_active_customer_count"), None)
    for fragment in ("COUNT(*)", "status = 'active'"):
        procedure_has_code(fragment)(procedure)


def indexed_table_query(om, fqn: str) -> Query[dict | None]:
    """The lineage workflow reads view definitions from the search index, not the REST entity."""
    query_filter = json.dumps({"query": {"term": {"fullyQualifiedName": fqn}}})

    def read():
        response = om.client.get(
            "/search/query", data={"q": "", "index": "table_search_index", "size": 2, "query_filter": query_filter}
        )
        hits = response["hits"]["hits"]
        assert len(hits) <= 1, f"{len(hits)} search documents share FQN {fqn}"
        return hits[0]["_source"] if hits else None

    return Query(f"indexed table {fqn}", read)


def indexed_schema_definition_contains(text: str):
    if not text:
        raise ValueError("schema definition text must not be empty")

    def check(document):
        assert document is not None, "table not indexed"
        definition = document.get("schemaDefinition") or ""
        assert text.lower() in definition.lower(), f"indexed schema definition missing {text!r}"

    return check


def partition_query(om, fqn: str) -> Query[Table | None]:
    """`tablePartition` is only returned when requested explicitly."""
    return Query(
        f"partition for {fqn}",
        lambda: om.get_by_name(entity=Table, fqn=fqn, fields=["columns", "tablePartition"], include="all"),
    )


def table_is_day_partitioned(column_name: str):
    def check(table):
        entity_exists(table)
        partition = table.tablePartition
        assert partition is not None and partition.columns, "table partition missing"
        details = [(item.columnName, item.intervalType, item.interval) for item in partition.columns]
        assert details == [(column_name, PartitionIntervalTypes.TIME_UNIT, "DAY")], f"partition: {details!r}"

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


NATIVE_SAMPLE_VALUES = {
    "int_col": 123456,
    "float_col": 1.5,
    "numeric_col": 1234.56,
    "bignumeric_col": 12345.6789,
    "bool_col": True,
    "string_col": "text value",
    "bytes_col": "bytes value",
    "date_col": "2026-01-02",
    "datetime_col": "2026-01-02T12:34:56",
    "time_col": "12:34:56",
    "timestamp_col": "2026-01-02T12:34:56+00:00",
    "json_col": {"kind": "fixture", "count": 2},
    "geography_col": "POINT(1 2)",
    "array_col": ["a", "b"],
    "struct_col": {"x": 7, "y": "seven"},
}
_NULL_SAMPLE_VALUES = {**dict.fromkeys(NATIVE_SAMPLE_VALUES), "array_col": []}


def sample_row_count(expected: int):
    def check(table):
        entity_exists(table)
        fqn = model_str(table.fullyQualifiedName)
        assert table.sampleData is not None, f"{fqn}: sample data missing"
        assert len(table.sampleData.rows) == expected, (
            f"{fqn}: sample row count: expected {expected}, got {len(table.sampleData.rows)}"
        )

    return check


def native_sample_rows(table):
    sample_row_count(3)(table)
    fqn = model_str(table.fullyQualifiedName)
    names = [name.root for name in table.sampleData.columns]
    expected_names = {"id", *NATIVE_SAMPLE_VALUES}
    assert len(names) == len(expected_names) and set(names) == expected_names, (
        f"{fqn}: sample columns: missing {sorted(expected_names - set(names))!r}, "
        f"unexpected {sorted(set(names) - expected_names)!r}, got {len(names)}"
    )
    rows = table.sampleData.rows
    lengths = [len(row) for row in rows]
    assert all(length == len(names) for length in lengths), (
        f"{fqn}: sample row widths: expected {len(names)} each, got {lengths!r}"
    )
    keyed = {row[names.index("id")]: dict(zip(names, row, strict=True)) for row in rows}
    assert set(keyed) == {1, 2, 3}, f"{fqn}: sample row IDs: expected {{1, 2, 3}}, got {set(keyed)!r}"
    return keyed


def native_samples_match(table, *, int_value=123456):
    keyed = native_sample_rows(table)
    expected_rows = {
        1: {"id": 1, **NATIVE_SAMPLE_VALUES, "int_col": int_value},
        2: {"id": 2, **_NULL_SAMPLE_VALUES},
        3: {"id": 3, **_NULL_SAMPLE_VALUES},
    }
    differences = {
        (key, name): (wanted, keyed[key][name])
        for key, expected in expected_rows.items()
        for name, wanted in expected.items()
        if keyed[key][name] != wanted
    }
    assert not differences, f"native sample cells differ (row, column): (expected, actual): {differences!r}"


def dq_case_query(om, fqn: str) -> Query[TestCase | None]:
    return Query(f"test case {fqn}", lambda: om.get_by_name(entity=TestCase, fqn=fqn, fields=_TEST_CASE_FIELDS))


def dq_case_has_status(status: TestCaseStatus):
    def check(test_case):
        entity_exists(test_case)
        result = test_case.testCaseResult
        assert result is not None, "test case result missing"
        assert result.testCaseStatus == status, (
            f"test case status: expected {status.value}, got {result.testCaseStatus}; {result.result!r}"
        )

    return check
