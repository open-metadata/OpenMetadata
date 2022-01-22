from unittest import TestCase

from metadata.utils.column_type_parser import ColumnTypeParser

COLUMN_TYPE_PARSE = [
    "array<string>",
    "struct<a:int,b:string>",
    "struct<a:struct<b:array<string>,c:bigint>>",
    "struct<a:array<string>>",
    "struct<bigquerytestdatatype51:array<struct<bigquery_test_datatype_511:array<string>>>>",
    "struct<record_1:struct<record_2:struct<record_3:struct<record_4:string>>>>",
    "array<struct<check_datatype:array<string>>>",
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
    {
        "children": [
            {
                "dataType": "ARRAY",
                "arrayDataType": "STRUCT",
                "dataTypeDisplay": "array<struct<bigquery_test_datatype_511:array<string>>>",
                "name": "bigquerytestdatatype51",
            }
        ],
        "dataTypeDisplay": "struct<bigquerytestdatatype51:array<struct<bigquery_test_datatype_511:array<string>>>>",
        "dataType": "STRUCT",
    },
    {
        "children": [
            {
                "children": [
                    {
                        "children": [
                            {
                                "children": [
                                    {
                                        "dataType": "STRING",
                                        "dataTypeDisplay": "string",
                                        "name": "record_4",
                                    }
                                ],
                                "dataTypeDisplay": "struct<record_4:string>",
                                "dataType": "STRUCT",
                                "name": "record_3",
                            }
                        ],
                        "dataTypeDisplay": "struct<record_3:struct<record_4:string>>",
                        "dataType": "STRUCT",
                        "name": "record_2",
                    }
                ],
                "dataTypeDisplay": "struct<record_2:struct<record_3:struct<record_4:string>>>",
                "dataType": "STRUCT",
                "name": "record_1",
            }
        ],
        "dataTypeDisplay": "struct<record_1:struct<record_2:struct<record_3:struct<record_4:string>>>>",
        "dataType": "STRUCT",
    },
    {
        "dataType": "ARRAY",
        "arrayDataType": "STRUCT",
        "dataTypeDisplay": "array<struct<check_datatype:array<string>>>",
    },
]


class ColumnTypeParseTest(TestCase):
    def test_check_datatype_support(self):
        for index, parse_string in enumerate(COLUMN_TYPE_PARSE):
            parsed_string = ColumnTypeParser._parse_datatype_string(parse_string)
            self.assertTrue(
                True if parsed_string == EXPECTED_OUTPUT[index] else False,
                msg=f"{index}: {COLUMN_TYPE_PARSE[index]} : {parsed_string}",
            )
