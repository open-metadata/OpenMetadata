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

RECURSIVE_AVRO_SCHEMA = """
{
   "name":"MainRecord",
   "type":"record",
   "fields":[
      {
         "default":"None",
         "name":"NestedRecord",
         "type":[
            "null",
            {
               "fields":[
                  {
                     "default":"None",
                     "name":"FieldA",
                     "type":[
                        "null",
                        {
                           "items":{
                              "fields":[
                                 {
                                    "name":"FieldAA",
                                    "type":"string"
                                 },
                                 {
                                    "default":"None",
                                    "name":"FieldBB",
                                    "type":[
                                       "null",
                                       "string"
                                    ]
                                 },
                                 {
                                    "default":"None",
                                    "name":"FieldCC",
                                    "type":[
                                       "null",
                                       "RecursionIssueRecord"
                                    ]
                                 }
                              ],
                              "name":"RecursionIssueRecord",
                              "type":"record"
                           },
                           "type":"array"
                        }
                     ]
                  }
               ],
               "name":"FieldInNestedRecord",
               "type":"record"
            }
         ]
      }
   ]
}
"""


ARRAY_OF_STR = """
{
  "type": "record",
  "name": "ArrayOfArrays",
  "fields": [
    {
      "name": "matrix",
      "type": {
        "type": "array",
        "items": "string"
      }
    }
  ]
}
"""

ARRAY_OF_ARRAY = """
{
  "type": "record",
  "name": "ArrayOfArrays",
  "fields": [
    {
      "name": "matrix",
      "type": {
        "type": "array",
        "items": {
          "type": "array",
          "items": "int"
        }
      }
    }
  ]
}
"""

ARRAY_OF_ARRAY_OF_RECORD = """
{
  "type": "record",
  "name": "ArrayOfArrays",
  "fields": [
    {
      "name": "matrix",
      "type": {
        "type": "array",
        "items": {
          "type": "array",
          "items": {
          "type": "record",
          "name": "Record",
          "fields": [
            {
              "name": "field1",
              "type": "string"
            },
            {
              "name": "field2",
              "type": "int"
            }
          ]
        }
        }
      }
    }
  ]
}
"""

ARRAY_OF_NESTED_ARRAY = """
{
  "type": "record",
  "name": "ArrayOfArrays",
  "fields": [
    {
      "name": "matrix",
      "type": {
        "type": "array",
        "items": {
          "type": "array",
          "items": {
            "type": "array",
            "items": {
                "type": "array",
                "items": {
                    "type": "array",
                    "items": "int"
                }
            }
          }
        }
      }
    }
  ]
}
"""


ARRAY_OF_NESTED_ARRAY_WITH_CHILD = """
{
  "type": "record",
  "name": "ArrayOfArrays",
  "fields": [
    {
      "name": "matrix",
      "type": {
        "type": "array",
        "items": {
          "type": "array",
          "items": {
            "type": "array",
            "items": {
                "type": "array",
                "items": {
                    "type": "array",
                    "items":{
                        "type": "record",
                        "name": "Record",
                        "fields": [
                            {
                            "name": "field1",
                            "type": "string"
                            },
                            {
                            "name": "field2",
                            "type": "int"
                            }
                        ]
                        }
                }
            }
          }
        }
      }
    }
  ]
}
"""

UNION_EXAMPLE_1 = """
{
  "type": "record",
  "name": "ArrayOfArrays",
  "fields": [
    {
      "name": "id",
      "type": ["null","int"]
    }
  ]
}
"""

UNION_EXAMPLE_2 = """
{
  "type": "record",
  "name": "ArrayOfArrays",
  "fields": [
    {
      "name": "id",
      "type": ["null","int","string","boolean"]
    }
  ]
}
"""

UNION_EXAMPLE_3 = """
{
  "type": "record",
  "name": "ArrayOfArrays",
  "fields": [
    {
      "name": "id",
      "type": [
        "null",
        {
          "type": "record",
          "name": "Record",
          "fields": [
            {
              "name": "field1",
              "type": "string"
            },
            {
              "name": "field2",
              "type": "int"
            }
          ]
        }
        ]
    }
  ]
}
"""


UNION_EXAMPLE_4 = """
{
  "type": "record",
  "name": "ArrayOfArrays",
  "fields": [
    {
      "name": "id",
      "type": [
        "null",
        {
          "type": "record",
          "name": "Record",
          "fields": [
            {
              "name": "field1",
              "type": "string"
            },
            {
              "name": "field2",
              "type": "int"
            }
          ]
        },
        {
          "type": "record",
          "name": "Record2",
          "fields": [
            {
              "name": "field1",
              "type": "string"
            },
            {
              "name": "field2",
              "type": "int"
            }
          ]
        }
        
        ]
    }
  ]
}
"""

UNION_OF_STR_AND_RECORD = """
{
  "type": "record",
  "name": "ArrayOfArrays",
  "fields": [
    {
      "name": "id",
      "type": [
        "string",
        {
          "type": "record",
          "name": "Record",
          "fields": [
            {
              "name": "field1",
              "type": "string"
            },
            {
              "name": "field2",
              "type": "int"
            }
          ]
        }
        ]
    }
  ]
}
"""


UNION_OF_ARRAY = """
{
  "type": "record",
  "name": "UnionOfArray",
  "fields": [
    {
      "name": "matrix",
      "type":[
            "null",
            {
            "type": "array",
            "items": "int"
            }
        ]
    }
  ]
}
"""


UNION_OF_ARRAY_OF_RECORD = """
{
  "type": "record",
  "name": "UnionOfArray",
  "fields": [
    {
      "name": "matrix",
      "type":[
            "null",
            {
            "type": "array",
            "items": {
          "type": "record",
          "name": "Record2",
          "fields": [
            {
              "name": "field1",
              "type": "string"
            },
            {
              "name": "field2",
              "type": "int"
            }
          ]
        }
            }
        ]
    }
  ]
}
"""

UNION_OF_ARRAY_OF_RECORD_1 = """
{
  "type": "record",
  "name": "UnionOfArray",
  "fields": [
    {
      "name": "matrix",
      "type":[
            "int",
            {
            "type": "array",
            "items": {
          "type": "record",
          "name": "Record2",
          "fields": [
            {
              "name": "field1",
              "type": "string"
            },
            {
              "name": "field2",
              "type": "int"
            }
          ]
        }
            }
        ]
    }
  ]
}
"""

RECORD_INSIDE_RECORD = """
{
  "type": "record",
  "name": "OuterRecord",
  "fields": [
    {
      "name": "id",
      "type": "int"
    },
    {
      "name": "name",
      "type": "string"
    },
    {
      "name": "innerRecord",
      "type": {
        "type": "record",
        "name": "InnerRecord",
        "fields": [
          {
            "name": "address",
            "type": "string"
          },
          {
            "name": "phoneNumbers",
            "type": {
              "type": "array",
              "items": "string"
            }
          }
        ]
      }
    },
    {
      "name": "tags",
      "type": {
        "type": "array",
        "items": "string"
      }
    }
  ]
}
"""

RECURSION_ISSUE_SAMPLE = """
{
  "type": "record",
  "name": "RecursionIssue",
  "namespace": "com.issue.recursion",
  "doc": "Schema with recursion issue",
  "fields": [
    {
      "name": "issue",
      "type": {
        "type": "record",
        "name": "Issue",
        "doc": "Global Schema Name",
        "fields": [
          {
            "name": "itemList",
            "default": null,
            "type": [
              "null",
              {
                "type": "array",
                "items": {
                  "type": "record",
                  "name": "Item",
                  "doc": "Item List  - Array of Sub Schema",
                  "fields": [
                    {
                      "name": "itemList",
                      "type": [
                        "null",
                        {
                          "type": "array",
                          "items": "Item"
                        }
                      ],
                      "default": null
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
"""


class AvroParserTests(TestCase):
    """
    Check methods from avro_parser.py
    """

    parsed_schema = parse_avro_schema(SAMPLE_AVRO_SCHEMA)

    def test_first_level(self):
        """
        Test nested schema
        """
        self.assertEqual(self.parsed_schema[0].name.root, "level")
        self.assertEqual(
            self.parsed_schema[0].description.root, "This is a first level record"
        )
        self.assertEqual(self.parsed_schema[0].dataType.name, "RECORD")

    def test_second_level(self):
        """
        Test nested schema
        """
        children = self.parsed_schema[0].children
        field_names = {str(field.name.root) for field in children}
        self.assertEqual(
            field_names,
            {"uid", "somefield", "options"},
        )

        field_types = {str(field.dataType.name) for field in children}
        self.assertEqual(field_types, {"INT", "STRING", "ARRAY"})

        field_descriptions = {
            field.description.root if field.description else None for field in children
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
        """
        Test nested schema
        """
        level3_record = self.parsed_schema[0].children[2].children[0]
        children = level3_record.children

        self.assertEqual(level3_record.name.root, "lvl2_record")
        self.assertEqual(
            level3_record.description.root, "The field represents a level 2 record"
        )
        self.assertEqual(level3_record.dataType.name, "RECORD")

        field_names = {str(field.name.root) for field in children}
        self.assertEqual(
            field_names,
            {"item1_lvl2", "item2_lvl2"},
        )

        field_types = {str(field.dataType.name) for field in children}
        self.assertEqual(field_types, {"STRING", "ARRAY"})

        field_descriptions = {
            field.description.root if field.description else None for field in children
        }
        self.assertEqual(field_descriptions, {None, "level 2 array"})

    def test_fourth_level(self):
        """
        Test nested schema
        """
        level3_record = self.parsed_schema[0].children[2].children[0]

        children = level3_record.children[1].children[0].children

        field_names = {str(field.name.root) for field in children}

        self.assertEqual(
            field_names,
            {"item1_lvl3", "item2_lvl3"},
        )

        field_types = {str(field.dataType.name) for field in children}

        self.assertEqual(field_types, {"STRING"})

    def parse_schema_assert_without_child(self, schema: str, display: str):
        example = parse_avro_schema(schema)
        self.assertIsNotNone(example)  # is parsed
        field = example[0].children[0]
        self.assertEqual(field.dataTypeDisplay, display)
        self.assertIsNone(field.children)  # no child

    def parse_schema_assert_one_child(self, schema: str, display: str):
        example = parse_avro_schema(schema)
        self.assertIsNotNone(example)  # is parsed
        field = example[0].children[0]
        self.assertEqual(field.dataTypeDisplay, display)
        # has one child
        self.assertIsNotNone(field.children)
        self.assertEqual(len(field.children), 1)

    def test_array_parsing(self):
        """
        Test array parsing
        """
        self.parse_schema_assert_without_child(ARRAY_OF_STR, "ARRAY<string>")
        self.parse_schema_assert_without_child(ARRAY_OF_ARRAY, "ARRAY<ARRAY<int>>")
        self.parse_schema_assert_without_child(
            ARRAY_OF_NESTED_ARRAY, "ARRAY<ARRAY<ARRAY<ARRAY<ARRAY<int>>>>>"
        )
        self.parse_schema_assert_one_child(
            ARRAY_OF_ARRAY_OF_RECORD, "ARRAY<ARRAY<record>>"
        )
        self.parse_schema_assert_one_child(
            ARRAY_OF_NESTED_ARRAY_WITH_CHILD,
            "ARRAY<ARRAY<ARRAY<ARRAY<ARRAY<record>>>>>",
        )

    def test_union_parsing(self):
        """
        Test union parsing
        """
        self.parse_schema_assert_without_child(UNION_EXAMPLE_1, "UNION<null,int>")
        self.parse_schema_assert_without_child(
            UNION_EXAMPLE_2, "UNION<null,int,string,boolean>"
        )
        self.parse_schema_assert_one_child(UNION_EXAMPLE_3, "UNION<null,record>")
        self.parse_schema_assert_without_child(
            UNION_EXAMPLE_4, "UNION<null,record,record>"
        )
        self.parse_schema_assert_without_child(UNION_OF_ARRAY, "UNION<null,ARRAY<int>>")
        self.parse_schema_assert_without_child(
            UNION_OF_STR_AND_RECORD, "UNION<string,record>"
        )
        self.parse_schema_assert_one_child(
            UNION_OF_ARRAY_OF_RECORD, "UNION<null,ARRAY<record>>"
        )
        self.parse_schema_assert_without_child(
            UNION_OF_ARRAY_OF_RECORD_1, "UNION<int,array>"
        )

    def test_nested_record_parsing(self):
        parsed_record_schema = parse_avro_schema(RECORD_INSIDE_RECORD)

        # test 1st level record
        self.assertEqual(parsed_record_schema[0].name.root, "OuterRecord")
        self.assertEqual(parsed_record_schema[0].dataType.name, "RECORD")

        # test 2nd level record
        self.assertEqual(parsed_record_schema[0].children[2].name.root, "innerRecord")
        self.assertEqual(parsed_record_schema[0].children[2].dataType.name, "RECORD")

        # test fields inside 2nd level record
        self.assertEqual(
            parsed_record_schema[0].children[2].children[0].name.root, "InnerRecord"
        )
        self.assertEqual(
            parsed_record_schema[0].children[2].children[0].dataType.name, "RECORD"
        )
        self.assertEqual(
            parsed_record_schema[0].children[2].children[0].children[1].name.root,
            "phoneNumbers",
        )
        self.assertEqual(
            parsed_record_schema[0].children[2].children[0].children[1].dataType.name,
            "ARRAY",
        )

    def test_recursive_record_parsing(self):
        parsed_recursive_schema = parse_avro_schema(RECURSIVE_AVRO_SCHEMA)

        # test that the recursive schema stops processing after 1st occurrence
        self.assertEqual(
            parsed_recursive_schema[0]
            .children[0]
            .children[0]
            .children[0]
            .children[0]
            .name.root,
            "RecursionIssueRecord",
        )
        self.assertEqual(
            parsed_recursive_schema[0]
            .children[0]
            .children[0]
            .children[0]
            .children[0]
            .children[2]
            .name.root,
            "FieldCC",
        )
        self.assertEqual(
            parsed_recursive_schema[0]
            .children[0]
            .children[0]
            .children[0]
            .children[0]
            .children[2]
            .children[0]
            .name.root,
            "RecursionIssueRecord",
        )
        self.assertIsNone(
            parsed_recursive_schema[0]
            .children[0]
            .children[0]
            .children[0]
            .children[0]
            .children[2]
            .children[0]
            .children
        )

    def test_recursive_issue_parsing(self):
        recur_parsed_schema = parse_avro_schema(RECURSION_ISSUE_SAMPLE)

        self.assertEqual(
            recur_parsed_schema[0]
            .children[0]
            .children[0]
            .children[0]
            .children[0]
            .name.root,
            "Item",
        )
        self.assertEqual(
            recur_parsed_schema[0].children[0].children[0].children[0].name.root,
            "itemList",
        )
        self.assertIsNone(
            recur_parsed_schema[0]
            .children[0]
            .children[0]
            .children[0]
            .children[0]
            .children[0]
            .children[0]
            .children
        )
