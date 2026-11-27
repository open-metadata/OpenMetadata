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
Helpers functions to handle columns when we extract
their raw information from the source
"""

from typing import cast

from metadata.generated.schema.entity.data.table import Column
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def truncate_column_name(col_name: str):
    """
    OpenMetadata column name specification limits column name to 256 characters.
    Truncate to 256 characters if longer and use displayName to have the raw column name.
    """
    return col_name[:256]


def _colonize_field_type(field_type: str) -> str:
    """Rewrite the first space of each top-level struct field of a nested struct/array
    body into the ``name:type`` form the shared parser expects, leaving parameters
    like ``decimal(10, 2)`` untouched via the bracket-aware split."""
    field_type = field_type.strip()
    if not field_type.endswith(">"):
        return field_type
    base = field_type.split("<", 1)[0].lower()
    if base == "struct":
        inner = field_type[len("struct<") : -1]
        parts = ColumnTypeParser._ignore_brackets_split(inner, ",")
        colonized = (_colonize_field_name(part) for part in parts)
        return f"struct<{','.join(colonized)}>"
    if base == "array":
        element = field_type[len("array<") : -1]
        return f"array<{_colonize_field_type(element)}>"
    return field_type


def _colonize_field_name(part: str) -> str:
    """Rewrite ``name type`` (or ``name:type``) to ``name:type`` for one struct field;
    struct field display is dialect-dependant (space vs colon separated)."""
    part = part.strip()
    space_idx = part.find(" ")
    colon_idx = part.find(":")
    # Split on the closer of space/colon: dialects print either form, and one may be
    # mixed into the other through a nested struct.
    if colon_idx != -1 and (space_idx == -1 or colon_idx < space_idx):
        name, _, rest = part.partition(":")
    else:
        name, _, rest = part.partition(" ")
    if not rest:
        return part
    name = name.strip().strip("`")
    return f"{name}:{_colonize_field_type(rest)}"


def parse_complex_column_type(type_str: str) -> dict | None:
    """Parse a nested STRUCT/ARRAY/MAP type string (e.g. ``struct<a int, b struct<c int>>``)
    with the shared bracket-aware parser. Returns the OpenMetadata column dict
    (dataType/dataTypeDisplay/arrayDataType/children) or None for primitives
    and for strings the parser cannot handle."""
    field_base = type_str.split("(", maxsplit=1)[0].split("<", maxsplit=1)[0].upper()
    # DATEV2/DATETIMEV3-style suffixed types resolve to their base above
    if field_base[-2:].lower() in ("v2", "v3"):
        field_base = field_base[:-2]
    if field_base not in ("STRUCT", "ARRAY", "MAP"):
        return None
    try:
        return cast("dict", ColumnTypeParser._parse_datatype_string(_colonize_field_type(type_str.lower())))
    except ValueError:
        logger.warning("Failed to parse nested type %s, ingesting it without child fields", str(type_str))
        return None


def column_from_parsed(ordinal: int, parsed: dict) -> Column:
    """Column entity for one struct field; deeper children validate recursively."""
    return Column(
        name=parsed["name"],
        dataType=parsed["dataType"],
        dataTypeDisplay=parsed["dataTypeDisplay"],
        dataLength=parsed.get("dataLength", 1),
        arrayDataType=parsed.get("arrayDataType"),
        children=parsed.get("children"),
        precision=parsed.get("precision"),
        scale=parsed.get("scale"),
        ordinalPosition=ordinal,
    )
