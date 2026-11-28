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
"""Pure persisted-state checks specific to the Athena fixture."""

from __future__ import annotations

from typing import Any

from metadata.generated.schema.entity.data.table import PartitionIntervalTypes, TableType
from metadata.ingestion.ometa.utils import model_str

from ..features.database.entities import entity_exists


def table_partitioned_by(columns: tuple[tuple[str, PartitionIntervalTypes], ...]):
    """The table is typed Partitioned and lists exactly these partition columns, in order."""
    if not columns:
        raise ValueError("expected partition columns must not be empty")

    def check(table):
        entity_exists(table)
        fqn = model_str(table.fullyQualifiedName)
        assert table.tableType == TableType.Partitioned, f"{fqn}: tableType {table.tableType}"
        assert table.tablePartition is not None, f"{fqn}: tablePartition missing"
        actual = tuple((item.columnName, item.intervalType) for item in table.tablePartition.columns or [])
        assert actual == columns, f"{fqn}: partition columns {actual!r}, expected {columns!r}"

    return check


def schema_has_exact_description(text: str):
    if not text:
        raise ValueError("description text must not be empty")

    def check(schema):
        entity_exists(schema)
        actual = model_str(schema.description) if schema.description is not None else None
        assert actual == text, f"schema description {actual!r}, expected {text!r}"

    return check


def sample_rows(table) -> list[dict[str, Any]]:
    entity_exists(table)
    fqn = model_str(table.fullyQualifiedName)
    assert table.sampleData is not None, f"{fqn}: sample data missing"
    names = [model_str(name) for name in table.sampleData.columns]
    for row in table.sampleData.rows:
        assert len(row) == len(names), f"{fqn}: sample row width {len(row)} for {len(names)} columns"
    return [dict(zip(names, row, strict=True)) for row in table.sampleData.rows]


def sample_row_count(expected: int):
    def check(table):
        rows = sample_rows(table)
        assert len(rows) == expected, f"expected {expected} sample rows, got {len(rows)}"

    return check


def native_samples_match(table):
    rows = sample_rows(table)
    assert len(rows) == 1, f"expected one native sample row, got {len(rows)}"
    row = rows[0]
    assert row["c_boolean"] is True, row["c_boolean"]
    assert row["c_tinyint"] == 127, row["c_tinyint"]
    assert row["c_smallint"] == 32767, row["c_smallint"]
    assert row["c_int"] == 1234567890, row["c_int"]
    assert row["c_bigint"] == 9223372036854775807, row["c_bigint"]
    assert row["c_varchar"] == "abcdefghij", row["c_varchar"]
    assert row["c_string"] == "native athena string", row["c_string"]


def order_statuses(table) -> dict[int, str]:
    return {row["id"]: row["status"] for row in sample_rows(table)}
