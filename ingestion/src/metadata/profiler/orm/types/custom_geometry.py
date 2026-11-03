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

# pylint: disable=abstract-method

"""Geometry read back as WKT when the driver hands us hex WKB"""

import re
import struct

import shapely
from shapely.errors import ShapelyError
from shapely.geometry.base import BaseGeometry
from sqlalchemy.engine import Dialect
from sqlalchemy.sql.sqltypes import String, TypeDecorator

from metadata.profiler.orm.types.undetermined_type import UndeterminedType

_HEX = re.compile(r"[0-9A-Fa-f]+")
_EWKB_SRID_FLAG = 0x20000000
# byte-order marker (1 byte) + geometry type (4 bytes)
_MIN_WKB_HEX_LENGTH = 10
_SRID_PREFIX_HEX_LENGTH = 8
# Their geometry storage format is always `SRID(4) + WKB`, never plain WKB.
_SRID_PREFIXED_DIALECTS = frozenset({"mysql", "mariadb"})


def _decode_complete_wkb(value: str) -> BaseGeometry | None:
    """The geometry `value` encodes, or None unless it is one complete hex WKB value."""
    if len(value) < _MIN_WKB_HEX_LENGTH or len(value) % 2 or not _HEX.fullmatch(value):
        return None

    byte_order = value[:2]
    if byte_order not in ("00", "01"):
        return None
    (geometry_type,) = struct.unpack("<I" if byte_order == "01" else ">I", bytes.fromhex(value[2:10]))
    has_srid = bool(geometry_type & _EWKB_SRID_FLAG)

    try:
        geom = shapely.from_wkb(value)
        # GEOS can stop before the end of the buffer, e.g. reading a MySQL SRID 0
        # prefix as a big-endian POINT header. Comparing the re-encoded length rejects
        # those shorter geometries and any that lost a Z/M dimension while decoding.
        if len(shapely.to_wkb(geom, hex=False, include_srid=has_srid)) != len(value) // 2:
            return None
    # NotImplementedError: curved types (CIRCULARSTRING, ...) parse in GEOS but shapely
    # refuses to build them.
    except (ShapelyError, ValueError, TypeError, NotImplementedError):
        return None
    return geom


def _hex_wkb_to_wkt(value: str) -> str | None:
    value = value.strip()
    geom = _decode_complete_wkb(value)
    if geom is None:
        return None
    # Some MySQL SRID prefixes also form a complete EWKB header (`00200000` is a
    # big-endian Point with the SRID flag), so the length guard cannot catch them. If the
    # bytes after a 4-byte prefix are a complete geometry on their own, the value is
    # ambiguous, and no WKT is safer than possibly wrong WKT.
    if _decode_complete_wkb(value[_SRID_PREFIX_HEX_LENGTH:]) is not None:
        return None
    return geom.wkt


class CustomGeometry(TypeDecorator):
    """A geometry column sampled as WKT, e.g. `POINT (1 2)`.

    Only hex strings are decoded (psycopg2 returns PostGIS EWKB that way). Raw bytes are
    never decoded: pymysql returns MySQL's `SRID(4) + WKB`, and with SRID 0 that prefix
    decodes into a plausible but wrong POINT. For the same reason MySQL and MariaDB values
    are never decoded, and a value that is still a complete geometry after dropping a
    4-byte prefix is treated as ambiguous. `shapely.wkb.loads(..., hex=True)` cannot
    tell the two apart either, since shapely 2.x ignores `hex`. Anything not proven to
    be a complete WKB value keeps the `UndeterminedType` marker.

    The class name is what keeps metrics off: `NOT_COMPUTE` and the pyodbc samplers'
    `NOT_COMPUTE_PYODBC` match on `column.type.__class__.__name__`.
    """

    impl = String
    cache_ok = True

    @property
    def python_type(self) -> type[str]:
        return str

    def process_result_value(self, value: object, dialect: Dialect) -> str | None:
        if value is None:
            return None
        if (
            isinstance(value, str)
            and getattr(dialect, "name", None) not in _SRID_PREFIXED_DIALECTS
            and (wkt := _hex_wkb_to_wkt(value)) is not None
        ):
            return wkt
        return UndeterminedType().process_result_value(value, dialect)
