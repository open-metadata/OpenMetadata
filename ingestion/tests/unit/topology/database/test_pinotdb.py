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
Unit tests for PinotDB column type mapping and PinotJSONType.

Verifies that Pinot scalar types resolve to the correct
OpenMetadata DataType string via get_type_custom + ColumnTypeParser,
and that PinotJSONType correctly normalizes all possible pinotdb driver
outputs for JSON columns (Issue #25721).
"""
import logging

import pytest
from sqlalchemy.sql.sqltypes import String

from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.pinotdb.custom_types import PinotJSONType

# ---------------------------------------------------------------------------
# Helpers — guarded import for pinotdb (optional dependency)
# ---------------------------------------------------------------------------

pinotdb = pytest.importorskip(
    "pinotdb",
    reason="pinotdb not installed — skipping Pinot type-mapping tests",
)

from metadata.ingestion.source.database.pinotdb.metadata import (  # noqa: E402
    get_type_custom,
)


def _resolve(pinot_type: str) -> str:
    """Return the OpenMetadata type string for a given Pinot type name."""
    sqa_class = get_type_custom(pinot_type, None)
    assert sqa_class is not None, f"get_type_custom returned None for '{pinot_type}'"
    return ColumnTypeParser.get_column_type(sqa_class())


@pytest.fixture()
def processor():
    """Return the result processor function from a PinotJSONType instance."""
    return PinotJSONType().process_result_value


# ---------------------------------------------------------------------------
# Section 1 — Pinot type-map resolution (requires pinotdb)
# ---------------------------------------------------------------------------


class TestPinotTypeMapping:
    """Verify that Pinot scalar types resolve to the correct OM DataType."""

    @pytest.mark.parametrize(
        "pinot_type, expected_om_type",
        [
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
    def test_pinot_type_mapping(self, pinot_type, expected_om_type):
        assert _resolve(pinot_type) == expected_om_type

    def test_double_mapping_is_supported_and_not_integer(self):
        result = _resolve("double")
        assert result != "INT", "Pinot DOUBLE is incorrectly mapped to INT"
        assert result in {"DOUBLE", "FLOAT"}

    def test_json_type_uses_custom_pinot_type(self):
        """The type map must reference PinotJSONType, not bare types.JSON."""
        assert get_type_custom("json", None) is PinotJSONType


# ---------------------------------------------------------------------------
# Section 2 — PinotJSONType TypeDecorator contract
# ---------------------------------------------------------------------------


class TestPinotJSONTypeContract:
    """Verify the structural contract of the TypeDecorator."""

    def test_impl_is_string(self):
        assert PinotJSONType.impl is String

    def test_cache_ok_is_true(self):
        assert PinotJSONType.cache_ok is True

    def test_python_type_is_dict(self):
        assert PinotJSONType().python_type is dict


# ---------------------------------------------------------------------------
# Section 3 — PinotJSONType result processor
# ---------------------------------------------------------------------------


class TestPinotJSONResultProcessor:
    """Verify process_result_value handles all pinotdb driver outputs."""

    # -- Test 1: Standard JSON string (multistage engine) --

    @pytest.mark.parametrize(
        "raw_value, expected",
        [
            pytest.param(
                '{"a": 1}',
                {"a": 1},
                id="json-object-string",
            ),
            pytest.param(
                '[{"name": "alpha"}, {"name": "beta"}]',
                [{"name": "alpha"}, {"name": "beta"}],
                id="json-array-string",
            ),
            pytest.param(
                '{"nested": {"key": [1, 2, 3]}}',
                {"nested": {"key": [1, 2, 3]}},
                id="nested-json-string",
            ),
        ],
    )
    def test_json_string_deserialized(self, processor, raw_value, expected):
        assert processor(raw_value, None) == expected

    # -- Test 2: Single-stage engine pass-through --

    def test_dict_passthrough(self, processor):
        original = {"a": 1, "b": [2, 3]}
        result = processor(original, None)
        assert result is original

    def test_list_passthrough(self, processor):
        original = [{"x": 1}, {"y": 2}]
        result = processor(original, None)
        assert result is original

    # -- Test 3: Null/empty handling --

    @pytest.mark.parametrize(
        "raw_value",
        [
            pytest.param(None, id="none"),
            pytest.param(False, id="false"),
            pytest.param("", id="empty-string"),
        ],
    )
    def test_null_empty_returns_none(self, processor, raw_value):
        assert processor(raw_value, None) is None

    # -- Test 4: Binary handling --

    @pytest.mark.parametrize(
        "raw_value, expected",
        [
            pytest.param(
                b'{"a": 1}',
                {"a": 1},
                id="bytes-object",
            ),
            pytest.param(
                bytearray(b"[1, 2, 3]"),
                [1, 2, 3],
                id="bytearray-list",
            ),
        ],
    )
    def test_binary_decoded_and_parsed(self, processor, raw_value, expected):
        assert processor(raw_value, None) == expected

    # -- Test 5: Malformed JSON (defensive) --

    def test_malformed_json_returns_raw_string(self, processor, caplog):
        raw_value = "{'a': 1"
        with caplog.at_level(logging.WARNING):
            result = processor(raw_value, None)
        assert result == raw_value
        assert "Failed to deserialize Pinot JSON value" in caplog.text

    def test_invalid_json_does_not_raise(self, processor):
        for bad_input in ["{not-json", "[unclosed", "just a string", "12.34.56"]:
            result = processor(bad_input, None)
            assert isinstance(result, str)

    # -- Test 6: Scalar value pass-through --

    @pytest.mark.parametrize(
        "raw_value, expected",
        [
            pytest.param(42, 42, id="int-scalar"),
            pytest.param(3.14, 3.14, id="float-scalar"),
            pytest.param(True, True, id="bool-true"),
        ],
    )
    def test_scalar_passthrough(self, processor, raw_value, expected):
        assert processor(raw_value, None) == expected


# ---------------------------------------------------------------------------
# Section 4 — Framework integration (column_type_parser wiring)
# ---------------------------------------------------------------------------


class TestPinotJSONFrameworkIntegration:
    """Verify PinotJSONType is registered in the framework-level mapping."""

    def test_column_type_mapping_contains_pinot_json(self):
        mapping = (
            ColumnTypeParser._COLUMN_TYPE_MAPPING
        )  # pylint: disable=protected-access
        assert PinotJSONType in mapping
        assert mapping[PinotJSONType] == "JSON"

    def test_get_column_type_resolves_pinot_json_instance(self):
        assert ColumnTypeParser.get_column_type(PinotJSONType()) == "JSON"

    def test_end_to_end_type_resolution(self):
        """Full chain: get_type_custom('json') -> PinotJSONType -> 'JSON'."""
        sqa_type = get_type_custom("json", None)
        assert sqa_type is PinotJSONType
        assert ColumnTypeParser.get_column_type(sqa_type()) == "JSON"
