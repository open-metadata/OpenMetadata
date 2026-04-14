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
"""
Unit tests for PinotDB column type mapping.

Verifies that Pinot scalar types resolve to the correct
OpenMetadata DataType string via get_type_custom + ColumnTypeParser.
Complex types (struct, map, array) are excluded: ARRAY requires a
constructor argument and their BLOB/ARRAY mappings are covered by
the generic column_type_parser tests.
"""
import pytest

from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.pinotdb.metadata import get_type_custom


def _resolve(pinot_type: str) -> str:
    """Return the OpenMetadata type string for a given Pinot type name."""
    sqa_class = get_type_custom(pinot_type, None)
    assert sqa_class is not None, f"get_type_custom returned None for '{pinot_type}'"
    return ColumnTypeParser.get_column_type(sqa_class())


@pytest.mark.parametrize(
    "pinot_type, expected_om_type",
    [
        ("double", "DOUBLE"),
        ("float", "FLOAT"),
        ("int", "BIGINT"),
        ("long", "BIGINT"),
        ("boolean", "BOOLEAN"),
        ("string", "STRING"),
        ("timestamp", "TIMESTAMP"),
        ("big_decimal", "DECIMAL"),
        ("bytes", "BYTES"),
        ("json", "JSON"),
    ],
)
def test_pinot_type_mapping(pinot_type, expected_om_type):
    assert _resolve(pinot_type) == expected_om_type


def test_double_not_mapped_to_int():
    """Explicit regression test: Pinot DOUBLE must never resolve to INT."""
    result = _resolve("double")
    assert result != "INT", "Pinot DOUBLE is incorrectly mapped to INT"
    assert result == "DOUBLE"
