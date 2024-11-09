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
from typing import List, Optional, Tuple, Type, Union

import avro.schema as avroschema
from avro.schema import ArraySchema, RecordSchema, Schema, UnionSchema
from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.type.schema import FieldModel
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

RECORD_DATATYPE_NAME = "RECORD"


def _parse_array_children(
    arr_item: Schema,
    cls: Type[BaseModel] = FieldModel,
    already_parsed: Optional[dict] = None,
) -> Tuple[str, Optional[Union[FieldModel, Column]]]:
    if isinstance(arr_item, ArraySchema):
        display_type, children = _parse_array_children(
            arr_item.items, cls=cls, already_parsed=already_parsed
        )
        return f"ARRAY<{display_type}>", children

    if isinstance(arr_item, UnionSchema):
        display_type, children = _parse_union_children(
            parent=None, union_field=arr_item, cls=cls, already_parsed=already_parsed
        )
        return f"UNION<{display_type}>", children

    if isinstance(arr_item, RecordSchema):
        child_obj = cls(
            name=arr_item.name,
            dataType=str(arr_item.type).upper(),
            children=get_avro_fields(arr_item, cls, already_parsed=already_parsed),
            description=arr_item.doc,
        )
        return str(arr_item.type), child_obj

    return str(arr_item.type), None


def parse_array_fields(
    field: ArraySchema,
    cls: Type[BaseModel] = FieldModel,
    already_parsed: Optional[dict] = None,
) -> Optional[List[Union[FieldModel, Column]]]:
    """
    Parse array field for avro schema

    In case of a simple array of primitive type,
    for example {"type":"array","items":"string"}
    the display type would be `ARRAY<string>`

    If it's a nested array the we will parse
    the nested array as well
    for example {"type":"array","items":{"type":"array","items":"string"}}
    the display type would be `ARRAY<ARRAY<string>>`

    If it's a array contains a record as an item it will be added as child of array
    the nested array as well
    for example {
                "type":"array",
                "items":{
                    "type":"array",
                    "items":{
                        "name":"test",
                        "type":"record",
                        "fields":[{"name":"id","type":"int"}]
                     }
                }
    the display type would be `ARRAY<ARRAY<record>>`


    """
    field_items = field.type.items

    obj = cls(
        name=field.name,
        dataType=str(field.type.type).upper(),
        description=field.doc,
    )

    display, children = _parse_array_children(
        arr_item=field.type.items, cls=cls, already_parsed=already_parsed
    )

    obj.dataTypeDisplay = f"ARRAY<{display}>"
    if cls == Column:
        obj.arrayDataType = str(field_items.type).upper()

    if children:
        obj.children = [children]

    return obj


def _parse_union_children(
    parent: Optional[Schema],
    union_field: UnionSchema,
    cls: Type[BaseModel] = FieldModel,
    already_parsed: Optional[dict] = None,
) -> Tuple[str, Optional[Union[FieldModel, Column]]]:
    non_null_schema = [
        (i, schema)
        for i, schema in enumerate(union_field.schemas)
        if schema.type != "null"
    ]
    sub_type = ",".join(str(schema.type) for schema in union_field.schemas)
    if len(union_field.schemas) == 2 and len(non_null_schema) == 1:
        field = non_null_schema[0][1]

        if isinstance(field, ArraySchema):
            display, children = _parse_array_children(
                arr_item=field.items, cls=cls, already_parsed=already_parsed
            )
            sub_type = [None, None]
            sub_type[non_null_schema[0][0]] = f"ARRAY<{display}>"
            sub_type[non_null_schema[0][0] ^ 1] = "null"
            return ",".join(sub_type), children

        # if the child is a recursive instance of parent we will only process it once
        if isinstance(field, RecordSchema):
            children = cls(
                name=field.name,
                dataType=str(field.type).upper(),
                children=None
                if field == parent
                else get_avro_fields(field, cls, already_parsed),
                description=field.doc,
            )
            return sub_type, children

    return sub_type, None


def parse_record_fields(
    field: RecordSchema,
    cls: Type[BaseModel] = FieldModel,
    already_parsed: Optional[dict] = None,
):
    """
    Parse the nested record fields for avro
    """
    children = cls(
        name=field.name,
        dataType=RECORD_DATATYPE_NAME,
        children=[
            cls(
                name=field.type.name,
                dataType=RECORD_DATATYPE_NAME,
                children=get_avro_fields(field.type, cls, already_parsed),
                description=field.type.doc,
            )
        ],
        description=field.doc,
    )
    return children


def parse_union_fields(
    parent: Optional[Schema],
    union_field: Schema,
    cls: Type[BaseModel] = FieldModel,
    already_parsed: Optional[dict] = None,
) -> Optional[List[Union[FieldModel, Column]]]:
    """
    Parse union field for avro schema

    While parsing the union field there are couple of possibilities
    if we are parsing union of primitive types for example:
        ["null","int","string"]
    the expected display type would be:
        UNION<null,int,string>

    if we have a special case of union of a null with a complex type like array
    this function would parse the complex type and accordingly prepare the display type
    in the same case if the complex type is record, it will be added as a children.

    for example: ["null", {"name":"test","type":"record","fields":[{"name":"id","type":"int"}]}]
    then the record "test" would be added as a child and the display type would be UNION<null,record>
    see `test_avro_parser.py` for more example


    If the union schema contains multiple complex type in that case
    we will not be able to parse it and in the display type the function just records
    the type of top level element

    for example: [
                    "null",
                    {"type":"array","items":"int"} ,
                    {"name":"test","type":"record","fields":[{"name":"id","type":"int"}]}
                ]
    even though we have a record in union schema it will not be added as child
    and the display type would be: UNION<null,array,record>
    """

    field_type = union_field.type
    obj = cls(
        name=union_field.name,
        dataType=str(field_type.type).upper(),
        description=union_field.doc,
    )
    sub_type, children = _parse_union_children(
        union_field=field_type, cls=cls, parent=parent, already_parsed=already_parsed
    )
    obj.dataTypeDisplay = f"UNION<{sub_type}>"
    if children and cls == FieldModel:
        obj.children = [children]
    return obj


def parse_single_field(
    field: Schema, cls: Type[BaseModel] = FieldModel
) -> Optional[List[Union[FieldModel, Column]]]:
    """
    Parse primitive field for avro schema
    """
    obj = cls(
        name=field.name,
        dataType=str(field.type.type).upper(),
        description=field.doc,
        dataTypeDisplay=str(field.type.type),
    )
    return obj


def parse_avro_schema(
    schema: str, cls: Type[BaseModel] = FieldModel
) -> Optional[List[Union[FieldModel, Column]]]:
    """
    Method to parse the avro schema
    """
    try:
        parsed_schema = avroschema.parse(schema)
        models = [
            cls(
                name=parsed_schema.name,
                dataType=str(parsed_schema.type).upper(),
                children=get_avro_fields(parsed_schema, cls, {}),
                description=parsed_schema.doc,
            )
        ]
        return models
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug(traceback.format_exc())
        logger.warning(f"Unable to parse the avro schema: {exc}")
    return None


def get_avro_fields(
    parsed_schema: Schema,
    cls: Type[BaseModel] = FieldModel,
    already_parsed: Optional[dict] = None,
) -> Optional[List[Union[FieldModel, Column]]]:
    """
    Recursively convert the parsed schema into required models
    """
    field_models = []

    if parsed_schema.name in already_parsed:
        if already_parsed[parsed_schema.name] == parsed_schema.type:
            return None
    else:
        already_parsed.update({parsed_schema.name: parsed_schema.type})

    for field in parsed_schema.fields:
        try:
            if isinstance(field.type, ArraySchema):
                field_models.append(
                    parse_array_fields(field, cls=cls, already_parsed=already_parsed)
                )
            elif isinstance(field.type, UnionSchema):
                field_models.append(
                    parse_union_fields(
                        union_field=field,
                        cls=cls,
                        parent=parsed_schema,
                        already_parsed=already_parsed,
                    )
                )
            elif isinstance(field.type, RecordSchema):
                field_models.append(
                    parse_record_fields(field, cls=cls, already_parsed=already_parsed)
                )
            else:
                field_models.append(parse_single_field(field, cls=cls))
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to parse the avro schema into models: {exc}")
    return field_models
