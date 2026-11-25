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

"""
Tests for the CustomGeometry type: hex WKB decodes to WKT, everything else keeps
the OPENMETADATA_UNDETERMIND marker rather than risk emitting wrong WKT.
"""

import struct
from types import SimpleNamespace

import pytest
import shapely

from metadata.profiler.orm.registry import NOT_COMPUTE
from metadata.profiler.orm.types.custom_geometry import CustomGeometry

MARKER = "OPENMETADATA_UNDETERMIND["

POLYGON = shapely.Polygon([(0, 0), (4, 0), (4, 4), (0, 4), (0, 0)])
POLYGON_HEX = shapely.to_wkb(POLYGON, hex=True)


def decode(value, dialect=None):
    return CustomGeometry().process_result_value(value, dialect)


class TestCustomGeometryDecoding:
    def test_little_endian_point(self):
        assert decode(shapely.to_wkb(shapely.Point(1, 2), hex=True, byte_order=1)) == "POINT (1 2)"

    def test_big_endian_polygon(self):
        value = shapely.to_wkb(POLYGON, hex=True, byte_order=0)
        assert decode(value) == POLYGON.wkt

    def test_multipolygon(self):
        multi = shapely.MultiPolygon([POLYGON, shapely.box(10, 10, 12, 12)])
        assert decode(shapely.to_wkb(multi, hex=True)) == multi.wkt

    def test_postgis_ewkb_with_srid(self):
        geom = shapely.set_srid(shapely.Point(3, 4), 4326)
        value = shapely.to_wkb(geom, hex=True, include_srid=True)
        assert decode(value) == "POINT (3 4)"

    def test_lowercase_hex(self):
        assert decode(POLYGON_HEX.lower()) == POLYGON.wkt

    def test_surrounding_whitespace(self):
        assert decode(f"  {POLYGON_HEX}\n") == POLYGON.wkt

    @pytest.mark.parametrize("flavor", ["iso", "extended"])
    def test_z_dimension_is_preserved(self, flavor):
        value = shapely.to_wkb(shapely.Point(1, 2, 3), hex=True, flavor=flavor)
        assert decode(value) == "POINT Z (1 2 3)"


class TestCustomGeometryRejection:
    @pytest.mark.parametrize("srid_prefix", ["00000000", "E6100000"])
    def test_mysql_srid_prefix_is_not_decoded(self, srid_prefix):
        """SRID 0 parses as a big-endian header and yields a garbage POINT
        unless the whole buffer is required to be consumed."""
        result = decode(srid_prefix + POLYGON_HEX)
        assert result.startswith(MARKER)
        assert "POINT" not in result

    def test_srid_prefix_that_forms_an_ewkb_header_is_not_decoded(self):
        """SRID 8192 (`00200000`) reads as a big-endian EWKB Point header with the SRID
        flag set, so the whole buffer is consumed and only the ambiguity check catches it."""
        value = "00200000" + shapely.to_wkb(shapely.Point(1, 2), hex=True)
        assert decode(value) == f"{MARKER}{value}]"

    @pytest.mark.parametrize("dialect_name", ["mysql", "mariadb"])
    def test_srid_prefixed_dialects_are_never_decoded(self, dialect_name):
        value = shapely.to_wkb(shapely.Point(1, 2), hex=True)
        assert decode(value, SimpleNamespace(name=dialect_name)) == f"{MARKER}{value}]"

    def test_postgres_dialect_is_decoded(self):
        value = shapely.to_wkb(shapely.Point(1, 2), hex=True)
        assert decode(value, SimpleNamespace(name="postgresql")) == "POINT (1 2)"

    def test_curved_geometry_falls_back_to_marker(self):
        """Shapely raises NotImplementedError for nonlinear types such as CIRCULARSTRING."""
        value = (b"\x01" + struct.pack("<II", 8, 3) + struct.pack("<6d", 0, 0, 1, 1, 2, 0)).hex()
        assert decode(value) == f"{MARKER}{value}]"

    @pytest.mark.parametrize("raw_type", [bytes, bytearray, memoryview])
    def test_raw_wkb_is_not_decoded(self, raw_type):
        result = decode(raw_type(shapely.to_wkb(POLYGON)))
        assert result.startswith(MARKER)
        assert "POLYGON (" not in result

    def test_raw_mysql_srid_prefixed_wkb_is_not_decoded(self):
        result = decode(b"\x00" * 4 + shapely.to_wkb(POLYGON))
        assert result.startswith(MARKER)
        assert "POLYGON (" not in result

    @pytest.mark.parametrize(
        "value",
        [
            "not-hex-at-all",
            POLYGON_HEX[:-1],
            "02" + POLYGON_HEX[2:],
            POLYGON_HEX[:30],
            "0101",
            POLYGON_HEX + "00000000",
            "",
        ],
        ids=["non_hex", "odd_length", "bad_byte_order", "truncated", "too_short", "trailing_bytes", "empty"],
    )
    def test_malformed_hex_falls_back_to_marker(self, value):
        assert decode(value) == f"{MARKER}{value}]"

    def test_none_stays_none(self):
        assert decode(None) is None

    def test_class_name_skips_metrics(self):
        assert CustomGeometry.__name__ in NOT_COMPUTE
