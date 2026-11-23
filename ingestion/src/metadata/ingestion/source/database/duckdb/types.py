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
Translate DuckDB type strings, as reported by ``information_schema.columns.data_type``,
into what OpenMetadata's ``ColumnTypeParser`` understands.

DuckDB reports nested types in its own syntax (``STRUCT(a INTEGER, "b c" VARCHAR)``,
``INTEGER[]``, ``VARCHAR[3]``, ``MAP(VARCHAR, INTEGER)``). The shared parser reads the
Hive-style syntax (``struct<a:integer>``, ``array<int>``, ``map<k,v>``), so nested types
are rewritten into it. Several DuckDB scalar names (unsigned and 128-bit integers, the
``TIMESTAMP_*`` precisions) have no entry in the shared parser and are mapped to their
closest OpenMetadata type; the original DuckDB spelling is kept as the display type.
"""

import re
from dataclasses import dataclass

from sqlalchemy import types as sa_types
from sqlalchemy.types import TypeEngine

DUCKDB_TO_OM_SCALAR = {
    "HUGEINT": "LARGEINT",
    "UHUGEINT": "LARGEINT",
    "UBIGINT": "LARGEINT",
    "UINTEGER": "BIGINT",
    "USMALLINT": "INT",
    "UTINYINT": "SMALLINT",
    "VARINT": "NUMERIC",
    "BIGNUM": "NUMERIC",
    "TIMESTAMP_NS": "TIMESTAMP",
    "TIMESTAMP_MS": "TIMESTAMP",
    "TIMESTAMP_S": "TIMESTAMP",
    "TIMESTAMP WITH TIME ZONE": "TIMESTAMPTZ",
    "TIME_NS": "TIME",
    "TIME WITH TIME ZONE": "TIME",
}

_OPENING_BRACKETS = {"(": ")", "[": "]"}
_CLOSING_BRACKETS = set(_OPENING_BRACKETS.values())
_PLAIN_IDENTIFIER = re.compile(r"\w+")


@dataclass(frozen=True)
class DuckDBColumnType:
    """A DuckDB column type ready for ``SqlColumnHandlerMixin``.

    ``om_type`` is what ``ColumnTypeParser.get_column_type`` maps for scalars.
    ``complex_type`` is the Hive-style string the parser expands into children,
    set only for STRUCT, MAP, LIST and ARRAY columns.
    """

    om_type: str
    complex_type: str | None = None


def _split_top_level(text: str, separator: str = ",") -> list[str]:
    """Split on ``separator`` outside brackets and outside quoted names or ENUM labels."""
    parts, depth, quote, start = [], 0, None, 0
    for index, char in enumerate(text):
        if quote:
            if char == quote:
                quote = None
        elif char in ("'", '"'):
            quote = char
        elif char in _OPENING_BRACKETS:
            depth += 1
        elif char in _CLOSING_BRACKETS:
            depth -= 1
        elif char == separator and depth == 0:
            parts.append(text[start:index].strip())
            start = index + 1
    parts.append(text[start:].strip())
    return [part for part in parts if part]


def _split_field(field: str) -> tuple[str, str]:
    """Split ``name TYPE`` or ``"quoted name" TYPE`` from a STRUCT field list."""
    if field.startswith('"'):
        closing = field.index('"', 1)
        while field[closing + 1 : closing + 2] == '"':
            closing = field.index('"', closing + 2)
        return field[1:closing].replace('""', '"'), field[closing + 1 :].strip()
    name, _, field_type = field.partition(" ")
    return name, field_type.strip()


def _field_name(name: str) -> str:
    return name if _PLAIN_IDENTIFIER.fullmatch(name) else f"`{name}`"


def _array_element(type_string: str) -> str | None:
    """Return the element type of ``T[]`` / ``T[n]``, or None when not an array."""
    if not type_string.endswith("]"):
        return None
    depth = 0
    for index in range(len(type_string) - 1, -1, -1):
        char = type_string[index]
        if char == "]":
            depth += 1
        elif char == "[":
            depth -= 1
            if depth == 0:
                return type_string[:index].strip()
    return None


def _scalar(type_string: str) -> str:
    base, bracket, rest = type_string.partition("(")
    base = base.strip().upper()
    if base in ("ENUM", "UNION"):
        return base
    mapped = DUCKDB_TO_OM_SCALAR.get(base, base)
    return f"{mapped}{bracket}{rest}"


def _to_hive(type_string: str) -> str:
    type_string = type_string.strip()
    element = _array_element(type_string)
    if element is not None:
        return f"array<{_to_hive(element)}>"
    upper = type_string.upper()
    if upper.startswith("STRUCT(") and type_string.endswith(")"):
        fields = (_split_field(field) for field in _split_top_level(type_string[7:-1]))
        return "struct<" + ",".join(f"{_field_name(name)}:{_to_hive(field_type)}" for name, field_type in fields) + ">"
    if upper.startswith("MAP(") and type_string.endswith(")"):
        key_type, value_type = _split_top_level(type_string[4:-1])
        return f"map<{_to_hive(key_type)},{_to_hive(value_type)}>"
    return _scalar(type_string)


def parse_duckdb_type(data_type: str) -> DuckDBColumnType:
    """Translate one ``information_schema.columns.data_type`` value."""
    data_type = data_type.strip()
    upper = data_type.upper()
    is_nested = _array_element(data_type) is not None or upper.startswith(("STRUCT(", "MAP("))
    if not is_nested:
        return DuckDBColumnType(om_type=_scalar(data_type))
    try:
        complex_type = _to_hive(data_type)
    except ValueError:
        return DuckDBColumnType(om_type=upper.split("(", 1)[0])
    om_type = complex_type.split("<", 1)[0].upper()
    return DuckDBColumnType(om_type=om_type, complex_type=complex_type)


_SQLA_TYPES: dict[str, type[TypeEngine]] = {
    "BIGINT": sa_types.BIGINT,
    "INT": sa_types.INTEGER,
    "INTEGER": sa_types.INTEGER,
    "SMALLINT": sa_types.SMALLINT,
    "TINYINT": sa_types.SMALLINT,
    "LARGEINT": sa_types.NUMERIC,
    "NUMERIC": sa_types.NUMERIC,
    "DECIMAL": sa_types.NUMERIC,
    "DOUBLE": sa_types.FLOAT,
    "FLOAT": sa_types.FLOAT,
    "REAL": sa_types.FLOAT,
    "BOOLEAN": sa_types.BOOLEAN,
    "DATE": sa_types.DATE,
    "TIME": sa_types.TIME,
    "TIMESTAMP": sa_types.TIMESTAMP,
    "TIMESTAMPTZ": sa_types.TIMESTAMP,
    "INTERVAL": sa_types.Interval,
    "VARCHAR": sa_types.VARCHAR,
    "BLOB": sa_types.LargeBinary,
    "UUID": sa_types.VARCHAR,
    "JSON": sa_types.JSON,
}


def sqla_type_for(data_type: str) -> TypeEngine:
    """SQLAlchemy type for reflection consumers; unknown and nested types fall back to VARCHAR."""
    base = parse_duckdb_type(data_type).om_type.split("(", 1)[0]
    return _SQLA_TYPES.get(base, sa_types.VARCHAR)()
