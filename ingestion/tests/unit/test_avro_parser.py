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
Avro parser tests
"""
from unittest import TestCase

from metadata.parsers.avro_parser import parse_avro_schema

SAMPLE_AVRO_SCHEMA = """
    {
    "namespace": "openmetadata.kafka",
    "name": "level",
    "type": "record",
    "doc": "This is a first level record",
    "fields": [
        {
            "name": "uid",
            "type": "int",
            "doc": "The field represents unique id"
        },
        {
            "name": "somefield",
            "type": "string"
        },
        {
            "name": "options",
            "doc": "The field represents options array",
            "type": {
                "type": "array",
                "items": {
                    "type": "record",
                    "name": "lvl2_record",
                    "doc": "The field represents a level 2 record",
                    "fields": [
                        {
                            "name": "item1_lvl2",
                            "type": "string"
                        },
                        {
                            "name": "item2_lvl2",
                            "doc": "level 2 array",
                            "type": {
                                "type": "array",
                                "items": {
                                    "type": "record",
                                    "name": "lvl3_record",
                                    "fields": [
                                        {
                                            "name": "item1_lvl3",
                                            "type": "string",
                                            "doc": "The field represents level3 item"
                                        },
                                        {
                                            "name": "item2_lvl3",
                                            "type": "string"
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
            }
        }
    ]
}
"""

# SAMPLE_AVRO_SCHEMA = """
# {
#   "type": "record",
#   "name": "ExampleUnionRecord",
#   "fields": [
#     {
#       "name": "id",
#       "type": "int"
#     },
#     {
#       "name": "data",
#       "type": [
#         "null",
#         {
#           "type": "record",
#           "name": "ExampleRecord",
#           "fields": [
#             {
#               "name": "name",
#               "type": "string"
#             },
#             {
#               "name": "age",
#               "type": "int"
#             }
#           ]
#         }
#       ]
#     }
#   ]
# }
# """


class AvroParserTests(TestCase):
    """
    Check methods from avro_parser.py
    """

    parsed_schema = parse_avro_schema(SAMPLE_AVRO_SCHEMA)

    def test_first_level(self):
        self.assertEqual(self.parsed_schema[0].name.__root__, "level")
        self.assertEqual(
            self.parsed_schema[0].description.__root__, "This is a first level record"
        )
        self.assertEqual(self.parsed_schema[0].dataType.name, "RECORD")

    def test_second_level(self):
        children = self.parsed_schema[0].children
        field_names = {str(field.name.__root__) for field in children}
        self.assertEqual(
            field_names,
            {"uid", "somefield", "options"},
        )

        field_types = {str(field.dataType.name) for field in children}
        self.assertEqual(field_types, {"INT", "STRING", "ARRAY"})

        field_descriptions = {
            field.description.__root__ if field.description else None
            for field in children
        }
        self.assertEqual(
            field_descriptions,
            {
                "The field represents unique id",
                None,
                "The field represents options array",
            },
        )

    def test_third_level(self):
        level3_record = self.parsed_schema[0].children[2].children[0]
        children = level3_record.children

        self.assertEqual(level3_record.name.__root__, "lvl2_record")
        self.assertEqual(
            level3_record.description.__root__, "The field represents a level 2 record"
        )
        self.assertEqual(level3_record.dataType.name, "RECORD")

        field_names = {str(field.name.__root__) for field in children}
        self.assertEqual(
            field_names,
            {"item1_lvl2", "item2_lvl2"},
        )

        field_types = {str(field.dataType.name) for field in children}
        self.assertEqual(field_types, {"STRING", "ARRAY"})

        field_descriptions = {
            field.description.__root__ if field.description else None
            for field in children
        }
        self.assertEqual(field_descriptions, {None, "level 2 array"})

    def test_fourth_level(self):
        level3_record = self.parsed_schema[0].children[2].children[0]

        children = level3_record.children[1].children[0].children

        field_names = {str(field.name.__root__) for field in children}

        self.assertEqual(
            field_names,
            {"item1_lvl3", "item2_lvl3", "item3_lvl3"},
        )

        field_types = {str(field.dataType.name) for field in children}

        self.assertEqual(field_types, {"STRING", "UNION"})
