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
Protobuf parser tests
"""

from unittest import TestCase

from metadata.parsers.protobuf_parser import ProtobufParser, ProtobufParserConfig


class ProtobufParserTests(TestCase):
    """
    Check methods from protobuf_parser.py
    """

    schema_name = "person_info"

    sample_protobuf_schema = """
    syntax = "proto3";
    package persons;
    enum Gender {
        M = 0; // male 
        F = 1; // female
        O = 2; // other
    }
    message PersonInfo {
        int32 age = 1; // age in years
        Gender gender = 2; 
        int32 height = 3; // height in cm
    }
    """

    protobuf_parser = ProtobufParser(
        config=ProtobufParserConfig(
            schema_name=schema_name, schema_text=sample_protobuf_schema
        )
    )
    parsed_schema = protobuf_parser.parse_protobuf_schema()

    def test_schema_name(self):
        self.assertEqual(self.parsed_schema[0].name.__root__, "PersonInfo")

    def test_schema_type(self):
        self.assertEqual(self.parsed_schema[0].dataType.name, "RECORD")

    def test_field_names(self):
        field_names = {
            str(field.name.__root__) for field in self.parsed_schema[0].children
        }
        self.assertEqual(field_names, {"height", "gender", "age"})

    def test_field_types(self):
        field_types = {
            str(field.dataType.name) for field in self.parsed_schema[0].children
        }
        self.assertEqual(field_types, {"INT", "ENUM"})
