import os
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
root = os.path.dirname(__file__)
import json

try:
    with open(os.path.join(root, "resources/expected_output_column_parser.json")) as f:
        EXPECTED_OUTPUT = json.loads(f.read())["data"]
except Exception as err:
    print(err)


class ColumnTypeParseTest(TestCase):
    def test_check_datatype_support(self):
        for index, parse_string in enumerate(COLUMN_TYPE_PARSE):
            parsed_string = ColumnTypeParser._parse_datatype_string(parse_string)
            self.assertTrue(
                True if parsed_string == EXPECTED_OUTPUT[index] else False,
                msg=f"{index}: {COLUMN_TYPE_PARSE[index]} : {parsed_string}",
            )
