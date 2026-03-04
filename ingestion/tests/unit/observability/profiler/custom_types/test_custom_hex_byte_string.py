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
Tests for HexByteString custom SQLAlchemy type.

Covers bytes, bytearray, and memoryview inputs, including values returned by
CockroachDB/PostgreSQL DBAPI drivers for BYTES/BINARY columns.
"""

import pytest

from metadata.profiler.orm.types.custom_hex_byte_string import HexByteString


@pytest.fixture
def hex_byte_string():
    return HexByteString()


class TestValidateHappyPath:
    def test_validate_accepts_bytes(self):
        HexByteString.validate(b"hello")

    def test_validate_accepts_bytearray(self):
        HexByteString.validate(bytearray(b"hello"))

    def test_validate_accepts_empty_bytes(self):
        HexByteString.validate(b"")

    def test_validate_accepts_empty_bytearray(self):
        HexByteString.validate(bytearray())


class TestProcessResultValueHappyPath:
    def test_none_returns_none(self, hex_byte_string):
        assert hex_byte_string.process_result_value(None, dialect=None) is None

    def test_bytes_returns_string(self, hex_byte_string):
        result = hex_byte_string.process_result_value(b"foo", dialect=None)
        assert isinstance(result, str)

    def test_bytearray_returns_string(self, hex_byte_string):
        result = hex_byte_string.process_result_value(bytearray(b"foo"), dialect=None)
        assert isinstance(result, str)

    def test_bytes_content_is_preserved(self, hex_byte_string):
        result = hex_byte_string.process_result_value(b"hello", dialect=None)
        assert "hello" in result

    def test_null_byte_is_stripped(self, hex_byte_string):
        result = hex_byte_string.process_result_value(b"hel\x00lo", dialect=None)
        assert "\x00" not in result


class TestMemoryviewHandling:
    def test_validate_accepts_memoryview(self):
        HexByteString.validate(memoryview(b"some binary data"))

    def test_validate_accepts_empty_memoryview(self):
        HexByteString.validate(memoryview(b""))

    def test_process_result_value_returns_string_for_memoryview(self, hex_byte_string):
        result = hex_byte_string.process_result_value(memoryview(b"foo"), dialect=None)
        assert isinstance(result, str)

    def test_process_result_value_preserves_memoryview_content(self, hex_byte_string):
        result = hex_byte_string.process_result_value(
            memoryview(b"hello world"), dialect=None
        )
        assert "hello world" in result

    def test_process_result_value_memoryview_null_byte_stripped(self, hex_byte_string):
        result = hex_byte_string.process_result_value(
            memoryview(b"hel\x00lo"), dialect=None
        )
        assert "\x00" not in result


class TestValidateErrorCases:
    def test_validate_rejects_string(self):
        with pytest.raises(TypeError, match="bytes-like values"):
            HexByteString.validate("not bytes")

    def test_validate_rejects_int(self):
        with pytest.raises(TypeError, match="bytes-like values"):
            HexByteString.validate(123)

    def test_validate_rejects_list(self):
        with pytest.raises(TypeError, match="bytes-like values"):
            HexByteString.validate([1, 2, 3])


class TestProcessLiteralParam:
    def test_process_literal_param_accepts_bytes(self, hex_byte_string):
        value = b"test"
        result = hex_byte_string.process_literal_param(value, dialect=None)
        assert result == value

    def test_process_literal_param_accepts_memoryview(self, hex_byte_string):
        mv = memoryview(b"test")
        result = hex_byte_string.process_literal_param(mv, dialect=None)
        assert result == mv

    def test_process_literal_param_rejects_invalid_type(self, hex_byte_string):
        with pytest.raises(TypeError, match="bytes-like values"):
            hex_byte_string.process_literal_param("invalid", dialect=None)
