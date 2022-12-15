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
Jsonschema parser tests
"""
from unittest import TestCase

from metadata.parsers.json_schema_parser import parse_json_schema


class JsonSchemaParserTests(TestCase):
    """
    Check methods from json_schema_parser.py
    """

    sample_json_schema = """{
        "$id": "https://example.com/person.schema.json",
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Person",
        "type": "object",
        "properties": {
            "firstName": {
            "type": "string",
            "description": "The person's first name."
            },
            "lastName": {
            "type": "string",
            "description": "The person's last name."
            },
            "age": {
            "description": "Age in years which must be equal to or greater than zero.",
            "type": "integer",
            "minimum": 0
            }
        }
    }"""

    parsed_schema = parse_json_schema(sample_json_schema)

    def test_schema_name(self):
        self.assertEqual(self.parsed_schema[0].name.__root__, "Person")

    def test_schema_type(self):
        self.assertEqual(self.parsed_schema[0].dataType.name, "RECORD")

    def test_field_names(self):
        field_names = {
            str(field.name.__root__) for field in self.parsed_schema[0].children
        }
        self.assertEqual(field_names, {"firstName", "lastName", "age"})

    def test_field_types(self):
        field_types = {
            str(field.dataType.name) for field in self.parsed_schema[0].children
        }
        self.assertEqual(field_types, {"INT", "STRING"})

    def test_field_descriptions(self):
        field_descriptions = {
            str(field.description.__root__) for field in self.parsed_schema[0].children
        }
        self.assertEqual(
            field_descriptions,
            {
                "The person's first name.",
                "The person's last name.",
                "Age in years which must be equal to or greater than zero.",
            },
        )
