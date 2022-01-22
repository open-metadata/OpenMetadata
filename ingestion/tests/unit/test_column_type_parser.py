from unittest import TestCase

from metadata.utils.column_type_parser import ColumnTypeParser

COLUMN_TYPE_PARSE = [
    "array<string>",
    "struct<a:int,b:string>",
    "struct<a:struct<b:array<string>,c:bigint>>",
    "struct<a:array<string>>",

]

EXPECTED_OUTPUT = [
    {
        "dataType": "ARRAY",
        "arrayDataType": "STRING",
        "dataTypeDisplay": "array<string>",
    },
    {
        "children": [
            {"dataType": "INT", "dataTypeDisplay": "int", "name": "a"},
            {"dataType": "STRING", "dataTypeDisplay": "string", "name": "b"},
        ],
        "dataTypeDisplay": "struct<a:int,b:string>",
        "dataType": "STRUCT",
    },
    {
        "children": [
            {
                "children": [
                    {
                        "dataType": "ARRAY",
                        "arrayDataType": "STRING",
                        "dataTypeDisplay": "array<string>",
                        "name": "b",
                    },
                    {"dataType": "BIGINT", "dataTypeDisplay": "bigint", "name": "c"},
                ],
                "dataTypeDisplay": "struct<b:array<string>,c:bigint>",
                "dataType": "STRUCT",
                "name": "a",
            }
        ],
        "dataTypeDisplay": "struct<a:struct<b:array<string>,c:bigint>>",
        "dataType": "STRUCT",
    },
    {
        "children": [
            {
                "dataType": "ARRAY",
                "arrayDataType": "STRING",
                "dataTypeDisplay": "array<string>",
                "name": "a",
            }
        ],
        "dataTypeDisplay": "struct<a:array<string>>",
        "dataType": "STRUCT",
    },
]


class ColumnTypeParseTest(TestCase):
    def test_check_datatype_support(self):
        for index, parse_string in enumerate(COLUMN_TYPE_PARSE):
            parsed_string = ColumnTypeParser._parse_datatype_string(parse_string)
            print(parsed_string)
            self.assertTrue(True if parsed_string == EXPECTED_OUTPUT[index] else False,msg=f"{index}: {COLUMN_TYPE_PARSE[index] }")
