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
"""Pure persisted-state checks specific to the Postgres native fixture."""

from metadata.ingestion.ometa.utils import model_str

from ..features.database.entities import entity_exists

NATIVE_COLUMN_NAMES = (
    "column1",
    "column2",
    "column5",
    "column6",
    "column7",
    "column8",
    "column9",
    "column10",
    "column11",
    "column12",
    "column13",
    "column14",
    "column15",
    "column16",
    "column17",
    "column28",
    "column29",
    "column20",
    "column21",
    "column22",
    "column23",
    "column24",
)


def native_sample_rows(table):
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


def native_samples_match(table, *, integer_value: int = 1234567890):
    row = native_sample_rows(table)
    assert row["column1"] == 1
    assert row["column5"] is True
    assert row["column10"] == integer_value
    assert row["column29"] == "abcdefghij"
    assert row["column24"] == "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
