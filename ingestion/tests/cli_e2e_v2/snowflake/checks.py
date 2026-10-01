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
"""Pure Snowflake fixture-specific persisted-state checks and queries."""

from __future__ import annotations

import json
import time
from collections import Counter
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedureType
from metadata.generated.schema.entity.data.table import (
    DmlOperationType,
    PartitionIntervalTypes,
    SystemProfile,
    Table,
    TableType,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.utils import model_str

from ..features._om_compat import unwrap_root_list
from ..features.database.entities import entity_exists, procedure_has_code
from ..runtime.expect import Query

_MAX_PROFILE_PAGES = 20
# testDefinition and testSuite are required by the generated TestCase model.
_TEST_CASE_FIELDS = ["testDefinition", "testSuite", "testCaseResult"]

if TYPE_CHECKING:
    from metadata.generated.schema.tests.basic import TestCaseStatus


def procedures_have_bodies(snapshot):
    procedures = {item.name.root: item for item in snapshot.procedures}
    procedure = procedures.get("SP_ACTIVE_CUSTOMER_COUNT")
    for fragment in ("COUNT(*)", "status = 'active'"):
        procedure_has_code(fragment)(procedure)
    assert procedure.storedProcedureType == StoredProcedureType.StoredProcedure, procedure.storedProcedureType
    function = procedures.get("FN_CONVERT_AMOUNT")
    procedure_has_code("amount * rate")(function)
    assert function.storedProcedureType == StoredProcedureType.UDF, function.storedProcedureType


def table_has_type(table_type: TableType):
    def check(table):
        entity_exists(table)
        assert table.tableType == table_type, f"table type: expected {table_type.value}, got {table.tableType}"

    return check


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


def table_is_clustered_by(*columns: str):
    """Snowflake cluster keys surface as COLUMN-VALUE partition columns, in key order."""
    if not columns:
        raise ValueError("cluster key columns must not be empty")

    def check(table):
        entity_exists(table)
        partition = table.tablePartition
        assert partition is not None and partition.columns, "table partition missing"
        details = [(item.columnName, item.intervalType) for item in partition.columns]
        wanted = [(name, PartitionIntervalTypes.COLUMN_VALUE) for name in columns]
        assert details == wanted, f"partition: expected {wanted!r}, got {details!r}"

    return check


def schema_query(om, fqn: str) -> Query[DatabaseSchema | None]:
    return Query(f"schema {fqn}", lambda: om.get_by_name(entity=DatabaseSchema, fqn=fqn, fields=["tags"]))


def has_tags(*tags: str):
    """Exact tag set, so a tag Snowflake reports only through inheritance cannot pass."""
    wanted = set(tags)

    def check(entity):
        entity_exists(entity)
        labels = unwrap_root_list(entity.tags)
        actual = {model_str(item.tagFQN) for item in labels}
        details = sorted((model_str(item.tagFQN), str(item.labelType), str(item.source)) for item in labels)
        assert actual == wanted, f"tags: expected {sorted(wanted)}, got {details}"

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
    "NUMBER_COL": 1234.56,
    "INT_COL": 123456,
    "FLOAT_COL": 1.5,
    "VARCHAR_COL": "text value",
    "CHAR_COL": "abc",
    "TEXT_COL": "long text value",
    "BOOL_COL": True,
    "DATE_COL": "2026-01-02",
    "TIME_COL": "12:34:56",
    "TS_NTZ_COL": "2026-01-02T12:34:56",
    "TS_LTZ_COL": "2026-01-02T12:34:56+00:00",
    "TS_TZ_COL": "2026-01-02T12:34:56+00:00",
    "BINARY_COL": "bytes value",
    "VARIANT_COL": {"kind": "fixture", "count": 2},
    "OBJECT_COL": {"x": 7, "y": "seven"},
    "ARRAY_COL": ["a", "b"],
    "GEOGRAPHY_COL": {"coordinates": [1, 2], "type": "Point"},
}
_NULL_SAMPLE_VALUES = dict.fromkeys(NATIVE_SAMPLE_VALUES)


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
    expected_names = {"ID", *NATIVE_SAMPLE_VALUES}
    assert len(names) == len(expected_names) and set(names) == expected_names, (
        f"{fqn}: sample columns: missing {sorted(expected_names - set(names))!r}, "
        f"unexpected {sorted(set(names) - expected_names)!r}, got {len(names)}"
    )
    rows = table.sampleData.rows
    lengths = [len(row) for row in rows]
    assert all(length == len(names) for length in lengths), (
        f"{fqn}: sample row widths: expected {len(names)} each, got {lengths!r}"
    )
    keyed = {row[names.index("ID")]: dict(zip(names, row, strict=True)) for row in rows}
    assert set(keyed) == {1, 2, 3}, f"{fqn}: sample row IDs: expected {{1, 2, 3}}, got {set(keyed)!r}"
    return keyed


def _comparable(name, value):
    """Compare the value, not the session's rendering of it.

    TIMESTAMP_LTZ renders in the session time zone, the account default. GEOGRAPHY renders as
    GeoJSON text, the default GEOGRAPHY_OUTPUT_FORMAT, with the driver's whitespace.
    """
    if name == "TS_LTZ_COL" and isinstance(value, str):
        return datetime.fromisoformat(value).astimezone(timezone.utc).isoformat()
    if name == "GEOGRAPHY_COL" and isinstance(value, str):
        return json.loads(value)
    return value


def native_samples_match(table, *, int_value=123456):
    keyed = native_sample_rows(table)
    expected_rows = {
        1: {"ID": 1, **NATIVE_SAMPLE_VALUES, "INT_COL": int_value},
        2: {"ID": 2, **_NULL_SAMPLE_VALUES},
        3: {"ID": 3, **_NULL_SAMPLE_VALUES},
    }
    differences = {
        (key, name): (wanted, keyed[key][name])
        for key, expected in expected_rows.items()
        for name, wanted in expected.items()
        if _comparable(name, keyed[key][name]) != wanted
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
