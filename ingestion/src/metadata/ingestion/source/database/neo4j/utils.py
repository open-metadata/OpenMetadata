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
Parse db.schema.*TypeProperties() rows and map Neo4j property types to OpenMetadata columns
"""

import re
from collections.abc import Iterable, Mapping
from typing import Any

from metadata.generated.schema.entity.data.table import Column, ColumnName, Constraint, DataType
from metadata.ingestion.source.database.neo4j.models import (
    GraphElementSpec,
    PropertySpec,
)

# Names are backtick-quoted, and a literal backtick inside a name is doubled.
_ELEMENT_NAME = re.compile(r"`((?:[^`]|``)*)`")

_SCALAR_TYPES: dict[str, DataType] = {
    "String": DataType.STRING,
    "Long": DataType.BIGINT,
    "Integer": DataType.BIGINT,
    "Double": DataType.DOUBLE,
    "Float": DataType.DOUBLE,
    "Boolean": DataType.BOOLEAN,
    "Date": DataType.DATE,
    "DateTime": DataType.TIMESTAMPZ,
    "ZonedDateTime": DataType.TIMESTAMPZ,
    "LocalDateTime": DataType.TIMESTAMP,
    "Time": DataType.TIME,
    "LocalTime": DataType.TIME,
    "Duration": DataType.INTERVAL,
    "Point": DataType.POINT,
}
_BYTE_ARRAY = "ByteArray"
_ARRAY_SUFFIX = "Array"


def parse_element_type(element_type: str | None) -> tuple[str, ...]:
    """Split a node or relationship type into names: ``:`Actor`:`Person``` -> ("Actor", "Person")."""
    return tuple(name.replace("``", "`") for name in _ELEMENT_NAME.findall(element_type or ""))


def aggregate_element_types(rows: Iterable[Mapping[str, Any]], type_key: str) -> list[GraphElementSpec]:
    """One spec per label (or relationship type) from db.schema.*TypeProperties() rows.

    A node with several labels is reported under a node type such as ``:`A`:`B```,
    so a label spans every node type it appears in: its property types are unioned,
    and a property is mandatory only if every node type carrying the label has it
    and marks it mandatory. Absence from one node type makes it optional.
    """
    element_types: dict[str, set[str]] = {}
    properties: dict[str, dict[str, dict[str, Any]]] = {}
    for row in rows:
        element_type: str = row.get(type_key) or ""
        for name in parse_element_type(element_type):
            element_types.setdefault(name, set()).add(element_type)
            property_name = row.get("propertyName")
            if not property_name:
                continue
            facts = properties.setdefault(name, {}).setdefault(
                property_name, {"types": set(), "present_in": set(), "all_mandatory": True}
            )
            facts["types"].update(row.get("propertyTypes") or ())
            facts["present_in"].add(element_type)
            facts["all_mandatory"] = facts["all_mandatory"] and bool(row.get("mandatory"))
    return [
        GraphElementSpec(
            name=name,
            properties=tuple(
                PropertySpec(
                    name=property_name,
                    types=tuple(sorted(facts["types"])),
                    mandatory=facts["all_mandatory"] and facts["present_in"] == element_types[name],
                )
                for property_name, facts in sorted(properties.get(name, {}).items())
            ),
        )
        for name in sorted(element_types)
    ]


def map_property_type(neo4j_types: Iterable[str]) -> tuple[DataType, DataType | None]:
    """(dataType, arrayDataType) for the set of Neo4j types observed on a property.

    Graph properties are schemaless, so a property can hold different types on
    different nodes; anything but a single known type maps to UNKNOWN rather than
    failing the ingestion.
    """
    types = sorted(set(neo4j_types))
    if len(types) != 1:
        return DataType.UNKNOWN, None
    only = types[0]
    if only == _BYTE_ARRAY:
        return DataType.BYTES, None
    if only.endswith(_ARRAY_SUFFIX):
        return DataType.ARRAY, _SCALAR_TYPES.get(only[: -len(_ARRAY_SUFFIX)], DataType.UNKNOWN)
    return _SCALAR_TYPES.get(only, DataType.UNKNOWN), None


def property_to_column(prop: PropertySpec) -> Column:
    data_type, array_data_type = map_property_type(prop.types)
    return Column(
        name=ColumnName(prop.name),
        dataType=data_type,
        arrayDataType=array_data_type,
        dataTypeDisplay=" | ".join(prop.types) or None,
        constraint=Constraint.NOT_NULL if prop.mandatory else None,
    )
