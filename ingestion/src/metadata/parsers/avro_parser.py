#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Utils module to parse the avro schema
"""

import traceback
from typing import List, Optional, Union

import avro.schema as avroschema
from avro.schema import ArraySchema
from pydantic.main import ModelMetaclass

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.type.schema import FieldModel
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def parse_array_fields(
    field, cls: ModelMetaclass = FieldModel
) -> Optional[List[Union[FieldModel, Column]]]:
    """
    Parse array field for avro schema
    """
    field_items = field.type.items
    child_obj = cls(
        name=field_items.name,
        dataType=str(field_items.type).upper(),
        children=get_avro_fields(field.type.items, cls),
    )

    obj = cls(
        name=field.name,
        dataType=str(field.type.type).upper(),
    )

    if cls == Column:
        if str(field_items.type).upper() == DataType.ARRAY.value:
            child_obj.arrayDataType = str(field.type.items.type).upper()
            child_obj.dataTypeDisplay = f"{field_items.type}<{field.type.items.type}>"
        else:
            child_obj.dataTypeDisplay = str(field_items.type)
        if str(field.type.type).upper() == DataType.ARRAY.value:
            obj.arrayDataType = str(field_items.type).upper()
            obj.dataTypeDisplay = f"{field.type.type}<{field_items.type}>"
        else:
            obj.dataTypeDisplay = str(field.type.type)

    obj.children = [child_obj]

    return obj


def parse_single_field(
    field, cls: ModelMetaclass = FieldModel
) -> Optional[List[Union[FieldModel, Column]]]:
    """
    Parse primitive field for avro schema
    """
    obj = cls(
        name=field.name,
        dataType=str(field.type.type).upper(),
    )
    if cls == Column:
        obj.dataTypeDisplay = str(field.type.type)
    return obj


def parse_avro_schema(
    schema: str, cls: ModelMetaclass = FieldModel
) -> Optional[List[Union[FieldModel, Column]]]:
    """
    Method to parse the avro schema
    """
    try:
        parsed_schema = avroschema.parse(schema)
        return get_avro_fields(parsed_schema, cls)
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug(traceback.format_exc())
        logger.warning(f"Unable to parse the avro schema: {exc}")
    return None


def get_avro_fields(
    parsed_schema, cls: ModelMetaclass = FieldModel
) -> Optional[List[Union[FieldModel, Column]]]:
    """
    Recursively convert the parsed schema into required models
    """
    field_models = []

    for field in parsed_schema.fields:
        try:
            if isinstance(field.type, ArraySchema):
                field_models.append(parse_array_fields(field, cls=cls))
            else:
                field_models.append(parse_single_field(field, cls=cls))
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to parse the avro schema into models: {exc}")
    return field_models
