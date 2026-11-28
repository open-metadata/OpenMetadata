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
Utilities to parse a Solr schema into OpenMetadata SearchIndexField models.
"""

import traceback
from typing import Any

from metadata.generated.schema.entity.data.searchIndex import DataType, SearchIndexField
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Map the trailing part of a Solr field-type ``class`` (e.g. "solr.StrField") to
# the closest OpenMetadata SearchIndex DataType. Anything unmapped is reported as
# UNKNOWN rather than dropped, so the field still appears in the catalog.
_SOLR_CLASS_TO_DATA_TYPE: dict[str, DataType] = {
    "StrField": DataType.KEYWORD,
    "TextField": DataType.TEXT,
    "BoolField": DataType.BOOLEAN,
    "UUIDField": DataType.KEYWORD,
    "BinaryField": DataType.BINARY,
    "IntPointField": DataType.INTEGER,
    "TrieIntField": DataType.INTEGER,
    "LongPointField": DataType.LONG,
    "TrieLongField": DataType.LONG,
    "FloatPointField": DataType.FLOAT,
    "TrieFloatField": DataType.FLOAT,
    "DoublePointField": DataType.DOUBLE,
    "TrieDoubleField": DataType.DOUBLE,
    "DatePointField": DataType.DATETIME,
    "TrieDateField": DataType.DATETIME,
    "DateRangeField": DataType.DATETIME,
    "LatLonPointSpatialField": DataType.GEO_POINT,
    "PointType": DataType.POINT,
    "SpatialRecursivePrefixTreeFieldType": DataType.GEO_SHAPE,
}


def _data_type_for_class(solr_class: str | None) -> DataType:
    if not solr_class:
        return DataType.UNKNOWN
    return _SOLR_CLASS_TO_DATA_TYPE.get(solr_class.split(".")[-1], DataType.UNKNOWN)


def parse_solr_schema(schema: dict[str, Any] | None) -> list[SearchIndexField]:
    """
    Convert a Solr schema payload into SearchIndexField models.

    Solr fields reference a field type by name; the field types carry the Java
    ``class`` that determines the data type. Both explicit ``fields`` and
    ``dynamicFields`` (whose name is a glob such as ``*_i``) are included.
    """
    field_models: list[SearchIndexField] = []
    if not schema:
        logger.debug("No Solr schema to parse")
        return field_models
    try:
        field_type_to_class = {
            field_type.get("name"): field_type.get("class") for field_type in schema.get("fieldTypes", [])
        }
        for field in [*schema.get("fields", []), *schema.get("dynamicFields", [])]:
            field_name = field.get("name")
            if not field_name:
                continue
            type_name = field.get("type")
            field_models.append(
                SearchIndexField(
                    name=field_name,
                    dataType=_data_type_for_class(field_type_to_class.get(type_name)),
                    dataTypeDisplay=type_name,
                )
            )
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug(traceback.format_exc())
        logger.warning("Unable to parse the Solr schema fields: %s", exc)

    return field_models
