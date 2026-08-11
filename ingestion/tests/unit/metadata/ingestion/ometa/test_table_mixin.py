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
Unit tests for the pre-serialization loop in OMetaTableMixin.ingest_table_sample_data
and the standalone _sanitize_sample_data_value helper.

Covers the conversion of types that are not JSON-serializable by Pydantic
into safe primitives before model_dump_json() is called, including:
  - ipaddress.IPv4Address / IPv6Address  (ClickHouse / PostgreSQL INET)
  - uuid.UUID                            (PostgreSQL UUID, Trino UUID)
  - decimal.Decimal                      (NUMERIC/DECIMAL columns)
  - datetime.timedelta                   (INTERVAL columns)
  - bytes                                (BINARY columns, MySQL WKB geometry)
  - nested list / dict                   (ARRAY, STRUCT, MAP, HSTORE columns)
  - arbitrary opaque objects             (catch-all for unknown driver types)
"""

import datetime
import decimal
import ipaddress
import json
import uuid
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.entity.data.table import TableData
from metadata.ingestion.ometa.mixins.table_mixin import (
    OMetaTableMixin,
    _sanitize_sample_data_value,
)


def _make_mixin() -> OMetaTableMixin:
    mixin = OMetaTableMixin.__new__(OMetaTableMixin)
    mixin.client = MagicMock()
    mixin.get_suffix = MagicMock(return_value="/api/v1/tables")
    return mixin


def _make_table():
    table = MagicMock()
    table.id.root = "test-table-id"
    table.fullyQualifiedName.root = "service.db.schema.table"
    return table


class TestIngestTableSampleDataPreprocessing:
    def test_ipv4_address_converted_to_string(self):
        mixin = _make_mixin()
        table = _make_table()
        sample_data = TableData(
            columns=["ip_col"],
            rows=[[ipaddress.IPv4Address("192.168.1.1")]],
        )
        mixin.client.put.return_value = None
        mixin.ingest_table_sample_data(table, sample_data)
        assert sample_data.rows[0][0] == "192.168.1.1"

    def test_ipv6_address_converted_to_string(self):
        mixin = _make_mixin()
        table = _make_table()
        sample_data = TableData(
            columns=["ip_col"],
            rows=[[ipaddress.IPv6Address("2001:db8::1")]],
        )
        mixin.client.put.return_value = None
        mixin.ingest_table_sample_data(table, sample_data)
        assert sample_data.rows[0][0] == "2001:db8::1"

    def test_bytes_still_base64_encoded(self):
        mixin = _make_mixin()
        table = _make_table()
        sample_data = TableData(
            columns=["bin_col"],
            rows=[[b"hello"]],
        )
        mixin.client.put.return_value = None
        mixin.ingest_table_sample_data(table, sample_data)
        assert sample_data.rows[0][0].startswith("[base64]")

    def test_plain_types_unchanged(self):
        mixin = _make_mixin()
        table = _make_table()
        sample_data = TableData(
            columns=["str_col", "int_col", "none_col"],
            rows=[["hello", 42, None]],
        )
        mixin.client.put.return_value = None
        mixin.ingest_table_sample_data(table, sample_data)
        assert sample_data.rows[0][0] == "hello"
        assert sample_data.rows[0][1] == 42
        assert sample_data.rows[0][2] is None

    def test_model_dump_json_succeeds_with_ipv4(self):
        mixin = _make_mixin()
        table = _make_table()
        sample_data = TableData(
            columns=["ip_col", "name_col"],
            rows=[[ipaddress.IPv4Address("10.0.0.1"), "alice"]],
        )
        mixin.client.put.return_value = None
        mixin.ingest_table_sample_data(table, sample_data)

        call_args = mixin.client.put.call_args
        raw_data = call_args[1].get("data") or call_args[0][1]
        parsed = json.loads(raw_data)
        assert parsed["rows"][0][0] == "10.0.0.1"
        assert parsed["rows"][0][1] == "alice"

    def test_mixed_row_with_ipv4_and_ipv6(self):
        mixin = _make_mixin()
        table = _make_table()
        sample_data = TableData(
            columns=["v4", "v6", "name"],
            rows=[
                [
                    ipaddress.IPv4Address("172.16.0.1"),
                    ipaddress.IPv6Address("fe80::1"),
                    "host",
                ]
            ],
        )
        mixin.client.put.return_value = None
        mixin.ingest_table_sample_data(table, sample_data)
        assert sample_data.rows[0][0] == "172.16.0.1"
        assert sample_data.rows[0][1] == "fe80::1"
        assert sample_data.rows[0][2] == "host"

    def test_uuid_converted_to_string(self):
        mixin = _make_mixin()
        table = _make_table()
        uid = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")
        sample_data = TableData(columns=["id_col"], rows=[[uid]])
        mixin.client.put.return_value = None
        mixin.ingest_table_sample_data(table, sample_data)
        assert sample_data.rows[0][0] == "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

    def test_decimal_finite_converted_to_float(self):
        mixin = _make_mixin()
        table = _make_table()
        sample_data = TableData(columns=["price_col"], rows=[[decimal.Decimal("3.14")]])
        mixin.client.put.return_value = None
        mixin.ingest_table_sample_data(table, sample_data)
        assert sample_data.rows[0][0] == pytest.approx(3.14)

    def test_decimal_infinity_converted_to_string(self):
        mixin = _make_mixin()
        table = _make_table()
        sample_data = TableData(columns=["val_col"], rows=[[decimal.Decimal("Infinity")]])
        mixin.client.put.return_value = None
        mixin.ingest_table_sample_data(table, sample_data)
        assert sample_data.rows[0][0] == "Infinity"

    def test_timedelta_converted_to_string(self):
        mixin = _make_mixin()
        table = _make_table()
        sample_data = TableData(
            columns=["interval_col"],
            rows=[[datetime.timedelta(days=1, seconds=3600)]],
        )
        mixin.client.put.return_value = None
        mixin.ingest_table_sample_data(table, sample_data)
        assert isinstance(sample_data.rows[0][0], str)
        assert "1 day" in sample_data.rows[0][0]


class TestSanitizeSampleDataValue:
    """
    Unit tests for the _sanitize_sample_data_value helper directly.
    """

    def test_none_passes_through(self):
        assert _sanitize_sample_data_value(None) is None

    def test_string_passes_through(self):
        assert _sanitize_sample_data_value("hello") == "hello"

    def test_int_passes_through(self):
        assert _sanitize_sample_data_value(42) == 42

    def test_float_passes_through(self):
        assert _sanitize_sample_data_value(3.14) == pytest.approx(3.14)

    def test_bool_passes_through(self):
        assert _sanitize_sample_data_value(True) is True
        assert _sanitize_sample_data_value(False) is False

    def test_bytes_base64_encoded(self):
        result = _sanitize_sample_data_value(b"hello")
        assert result.startswith("[base64]")

    def test_ipv4_to_string(self):
        assert _sanitize_sample_data_value(ipaddress.IPv4Address("192.168.1.1")) == "192.168.1.1"

    def test_ipv6_to_string(self):
        assert _sanitize_sample_data_value(ipaddress.IPv6Address("2001:db8::1")) == "2001:db8::1"

    def test_uuid_to_string(self):
        uid = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")
        assert _sanitize_sample_data_value(uid) == "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

    def test_decimal_finite_to_float(self):
        assert _sanitize_sample_data_value(decimal.Decimal("3.14")) == pytest.approx(3.14)

    def test_decimal_infinity_to_string(self):
        assert _sanitize_sample_data_value(decimal.Decimal("Infinity")) == "Infinity"

    def test_decimal_negative_infinity_to_string(self):
        assert _sanitize_sample_data_value(decimal.Decimal("-Infinity")) == "-Infinity"

    def test_decimal_nan_to_string(self):
        assert _sanitize_sample_data_value(decimal.Decimal("NaN")) == "NaN"

    def test_timedelta_to_string(self):
        result = _sanitize_sample_data_value(datetime.timedelta(days=2, hours=3))
        assert isinstance(result, str)

    def test_list_recursively_sanitized(self):
        # Simulates a PostgreSQL ARRAY column returning UUIDs
        uid1 = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")
        uid2 = uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8")
        result = _sanitize_sample_data_value([uid1, uid2])
        assert result == [
            "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
        ]

    def test_list_with_primitives_unchanged(self):
        assert _sanitize_sample_data_value([1, "a", True, None]) == [1, "a", True, None]

    def test_dict_recursively_sanitized(self):
        # Simulates a HSTORE / STRUCT column returning a UUID value
        uid = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")
        result = _sanitize_sample_data_value({"key": uid})
        assert result == {"key": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"}

    def test_opaque_object_uses_str_catchall(self):
        # Simulates an opaque driver object such as psycopg2.extras.Inet
        class FakeInet:
            def __str__(self):
                return "10.0.0.0/8"

        assert _sanitize_sample_data_value(FakeInet()) == "10.0.0.0/8"

    def test_unserializable_object_returns_sentinel(self):
        class Broken:
            def __str__(self):
                raise RuntimeError("broken __str__")

        assert _sanitize_sample_data_value(Broken()) == "[unserializable]"

    # --- Gap 1: float non-finite values ---

    def test_finite_float_passes_through(self):
        assert _sanitize_sample_data_value(3.14) == pytest.approx(3.14)

    def test_float_zero_passes_through(self):
        assert _sanitize_sample_data_value(0.0) == 0.0

    def test_float_infinity_to_string(self):
        assert _sanitize_sample_data_value(float("inf")) == "inf"

    def test_float_negative_infinity_to_string(self):
        assert _sanitize_sample_data_value(float("-inf")) == "-inf"

    def test_float_nan_to_string(self):
        result = _sanitize_sample_data_value(float("nan"))
        assert isinstance(result, str)

    # --- Gap 2: datetime.datetime and datetime.date ---

    def test_datetime_naive_to_iso_string(self):
        dt = datetime.datetime(2024, 1, 15, 10, 30, 0)
        assert _sanitize_sample_data_value(dt) == "2024-01-15T10:30:00"

    def test_datetime_aware_to_iso_string(self):
        dt = datetime.datetime(2024, 1, 15, 10, 30, 0, tzinfo=datetime.timezone.utc)
        result = _sanitize_sample_data_value(dt)
        assert result == "2024-01-15T10:30:00+00:00"

    def test_date_to_iso_string(self):
        d = datetime.date(2024, 1, 15)
        assert _sanitize_sample_data_value(d) == "2024-01-15"

    def test_datetime_subclass_of_date_is_preserved(self):
        # Ensures datetime.datetime is checked before datetime.date so the
        # time component is not silently dropped.
        dt = datetime.datetime(2024, 6, 1, 12, 0, 0)
        result = _sanitize_sample_data_value(dt)
        assert "12:00:00" in result

    # --- Gap 3: dict keys coerced to str ---

    def test_dict_with_integer_keys_become_strings(self):
        result = _sanitize_sample_data_value({1: "a", 2: "b"})
        assert result == {"1": "a", "2": "b"}

    def test_dict_with_mixed_key_types(self):
        uid = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")
        result = _sanitize_sample_data_value({uid: "val"})
        assert "6ba7b810-9dad-11d1-80b4-00c04fd430c8" in result
