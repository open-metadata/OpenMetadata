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
"""Pure persisted-state checks specific to the MSSQL native fixture."""

from metadata.ingestion.ometa.utils import model_str

from ..features.database.entities import entity_exists, procedure_has_code
from .baseline import (
    ACTIVE_CUSTOMER_PROCEDURE,
    NATIVE_COLUMN_NAMES,
    NATIVE_INTEGER_COLUMN,
    NATIVE_INTEGER_VALUE,
    NATIVE_UUID_VALUE,
    NATIVE_XML_VALUE,
    ROWVERSION_COLUMN,
)


def procedure_has_body(snapshot):
    """The owned procedure's body survives ingestion, read off the catalog snapshot."""
    procedure = next(
        (item for item in snapshot.procedures if item.name.root == ACTIVE_CUSTOMER_PROCEDURE),
        None,
    )
    procedure_has_code("SELECT COUNT(*) AS active_customers")(procedure)


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
    for name, expected in (
        ("id", 1),
        (NATIVE_INTEGER_COLUMN, integer_value),
        ("bit_col", True),
        ("varchar_col", "abcdefghij"),
        ("xml_col", NATIVE_XML_VALUE),
    ):
        assert row[name] == expected, f"{name} sample: expected {expected!r}, got {row[name]!r}"
    actual_uuid = row["uniqueidentifier_col"]
    assert actual_uuid.lower() == str(NATIVE_UUID_VALUE), f"uniqueidentifier_col sample: got {actual_uuid!r}"
    # SQL Server generates the rowversion, so only its shape is authored: #34360's
    # conversion turns the 8 raw bytes into the unsigned counter they encode.
    rowversion = row[ROWVERSION_COLUMN]
    assert isinstance(rowversion, int) and not isinstance(rowversion, bool), f"rowversion sample {rowversion!r}"
    assert rowversion > 0, f"rowversion sample {rowversion!r}"


def sample_row_count(expected: int):
    def check(table):
        entity_exists(table)
        assert table.sampleData is not None, "sample data missing"
        actual = len(table.sampleData.rows)
        assert actual == expected, f"sample rows: expected {expected}, got {actual}"

    return check
