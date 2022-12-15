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
from typing import List, Optional

import avro.schema as avroschema
from avro.schema import ArraySchema

from metadata.generated.schema.type.schema import FieldModel
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def parse_avro_schema(schema: str) -> Optional[List[FieldModel]]:
    """
    Method to parse the avro schema
    """
    try:
        parsed_schema = avroschema.parse(schema)
        field_models = [
            FieldModel(
                name=parsed_schema.name,
                dataType=str(parsed_schema.type).upper(),
                children=get_avro_fields(parsed_schema),
            )
        ]
        return field_models
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug(traceback.format_exc())
        logger.warning(f"Unable to parse the avro schema: {exc}")
    return None


def get_avro_fields(parsed_schema) -> Optional[List[FieldModel]]:
    """
    Recursively convert the parsed schema into required models
    """
    field_models = []

    for field in parsed_schema.fields:
        try:
            if isinstance(field.type, ArraySchema):
                field_items = field.type.items
                field_models.append(
                    FieldModel(
                        name=field.name,
                        dataType=str(field.type.type).upper(),
                        children=[
                            FieldModel(
                                name=field_items.name,
                                dataType=str(field_items.type).upper(),
                                children=get_avro_fields(field.type.items),
                            )
                        ],
                    )
                )
            else:
                field_models.append(
                    FieldModel(
                        name=field.name, dataType=str(field.type.fullname).upper()
                    )
                )
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to parse the avro schema into models: {exc}")
    return field_models
