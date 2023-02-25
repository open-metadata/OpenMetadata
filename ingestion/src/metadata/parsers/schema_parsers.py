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
Hosts the singledispatch to get the schema parsers
"""

from typing import List, Optional

from metadata.generated.schema.type.schema import FieldModel, SchemaType
from metadata.utils.dispatch import enum_register

schema_parser_config_registry = enum_register()


class InvalidSchemaTypeException(Exception):
    """
    Raised when we cannot find the provided schema type
    """


# Load parsers only on demand
# pylint: disable=import-outside-toplevel
@schema_parser_config_registry.add(SchemaType.Avro.value.lower())
def load_avro_parser(
    topic_name: str, schema_text: str  # pylint: disable=unused-argument
) -> Optional[List[FieldModel]]:
    from metadata.parsers.avro_parser import parse_avro_schema

    return parse_avro_schema(schema_text)


@schema_parser_config_registry.add(SchemaType.Protobuf.value.lower())
def load_protobuf_parser(
    topic_name: str, schema_text: str
) -> Optional[List[FieldModel]]:
    from metadata.parsers.protobuf_parser import ProtobufParser, ProtobufParserConfig

    protobuf_parser = ProtobufParser(
        config=ProtobufParserConfig(schema_name=topic_name, schema_text=schema_text)
    )
    return protobuf_parser.parse_protobuf_schema()


@schema_parser_config_registry.add(SchemaType.JSON.value.lower())
def load_json_schema_parser(
    topic_name: str, schema_text: str  # pylint: disable=unused-argument
) -> Optional[List[FieldModel]]:
    from metadata.parsers.json_schema_parser import parse_json_schema

    return parse_json_schema(schema_text)


@schema_parser_config_registry.add(SchemaType.Other.value.lower())
def load_other_schema_parser(
    topic_name: str, schema_text: str  # pylint: disable=unused-argument
) -> Optional[List[FieldModel]]:
    return None
