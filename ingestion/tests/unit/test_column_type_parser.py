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
Test column type in column_type_parser
"""

import json
import logging
import os
from unittest import TestCase

import pytest

from metadata.generated.schema.entity.data.table import DataType
from metadata.ingestion.source.dashboard.superset.mixin import SupersetSourceMixin
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.utils.datalake.datalake_utils import GenericDataFrameColumnParser

COLUMN_TYPE_PARSE = [
    "array<string>",
    "struct<a:int,b:string>",
    "struct<>",
    "struct<a:struct<b:array<string>,c:bigint>>",
    "struct<a:array<string>>",
    "struct<bigquerytestdatatype51:array<struct<bigquery_test_datatype_511:array<string>>>>",
    "struct<record_1:struct<record_2:struct<record_3:struct<record_4:string>>>>",
    "array<struct<check_datatype:array<string>>>",
    "struct<type:string,provider:array<int>>",
    "s",
    "bigint",
    "double",
    "VARCHAR(16777216)",
    "date",
    "timestamp",
    "array<int>",
    "array<struct<type:string,provider:array<int>>>",
    "array<binary>",
    "map<integer,string>",
    "string",
    "uniontype<int,double,array<string>,struct<a:int,b:string>>",
    "array<array<double>>",
]

COLUMN_TYPE = [
    "ARRAY",
    "BIGINT",
    "BINARY VARYING",
    "CURSOR",
    "DATETIME",
    "DATETIMEOFFSET",
    "GEOGRAPHY",
    "INT2",
    "INT8",
    "INT128",
    "UINT2",
    "LONGBLOB",
    "JSONB",
    "POINT",
    "Random1",
]

EXPTECTED_COLUMN_TYPE = [
    "ARRAY",
    "BIGINT",
    "VARBINARY",
    "BINARY",
    "DATETIME",
    "DATETIME",
    "GEOGRAPHY",
    "SMALLINT",
    "BIGINT",
    "BIGINT",
    "SMALLINT",
    "LONGBLOB",
    "JSON",
    "GEOMETRY",
    "UNKNOWN",
]
root = os.path.dirname(__file__)  # noqa: PTH120


try:
    with open(  # noqa: PTH123
        os.path.join(root, "resources/expected_output_column_parser.json"),  # noqa: PTH118
        encoding="UTF-8",
    ) as f:
        EXPECTED_OUTPUT = json.loads(f.read())["data"]
except Exception as exc:
    logging.error(exc)


class ColumnTypeParseTest(TestCase):
    def test_check_datatype_support(self):
        for index, parse_string in enumerate(COLUMN_TYPE_PARSE):
            parsed_string = ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
                parse_string
            )
            self.assertTrue(
                parsed_string == EXPECTED_OUTPUT[index],
                msg=f"{index}: {parse_string} : {parsed_string}",
            )

    def test_check_column_type(self):
        self.assertEqual(len(COLUMN_TYPE), len(EXPTECTED_COLUMN_TYPE))
        for index, column in enumerate(COLUMN_TYPE):
            column_type = ColumnTypeParser.get_column_type(column_type=column)
            self.assertEqual(EXPTECTED_COLUMN_TYPE[index], column_type)


def test_check_datalake_type():
    import pandas as pd  # pylint: disable=import-outside-toplevel

    assert_col_type_dict = {
        "column1": DataType.INT,
        "column2": DataType.STRING,
        "column3": DataType.BOOLEAN,
        "column4": DataType.FLOAT,
        "column5": DataType.DATETIME,
        "column6": DataType.DATETIME,
        "column7": DataType.INT,
        "column8": DataType.STRING,
        "column9": DataType.STRING,
        "column10": DataType.JSON,
        "column11": DataType.ARRAY,
    }
    df = pd.read_csv(root + "/test_column_type_parser.csv")
    for column_name in df.columns.values.tolist():
        assert assert_col_type_dict.get(column_name) == GenericDataFrameColumnParser.fetch_col_types(df, column_name)


def test_superset_parse_array_data_type():
    """Test the parse_array_data_type method with different input scenarios"""
    col_parse = {"dataType": "ARRAY", "arrayDataType": "STRING"}
    result = SupersetSourceMixin.parse_array_data_type(None, col_parse)
    assert result == DataType.STRING
    col_parse = {"dataType": "ARRAY", "arrayDataType": None}
    result = SupersetSourceMixin.parse_array_data_type(None, col_parse)
    assert result == DataType.UNKNOWN
    col_parse = {"dataType": "STRING", "arrayDataType": None}
    result = SupersetSourceMixin.parse_array_data_type(None, col_parse)
    assert result == None  # noqa: E711


def test_struct_field_name_with_colons():
    """Delta column-mapped struct field names contain ':' -- issue #29996.

    The last top-level ':' separates name from type; the rest belongs to the name.
    """
    parsed = ColumnTypeParser._parse_datatype_string(
        "struct<baselineproportions:1:behavioral_segment_search_for_dm:bigint>"
    )
    children = parsed["children"]

    assert parsed["dataType"] == "STRUCT"
    assert len(children) == 1
    assert children[0]["name"] == "baselineproportions:1:behavioral_segment_search_for_dm"
    assert children[0]["dataType"] == "BIGINT"


def test_struct_field_name_with_colons_backtick_quoted():
    """Databricks may render a colon-path field name backtick-quoted."""
    parsed = ColumnTypeParser._parse_datatype_string("struct<`a:b:c`:bigint>")
    children = parsed["children"]

    assert len(children) == 1
    assert children[0]["name"] == "a:b:c"
    assert children[0]["dataType"] == "BIGINT"


def test_struct_field_name_with_colons_mixed_and_nested():
    """A colon-name field alongside a normal field and a nested struct field."""
    parsed = ColumnTypeParser._parse_datatype_string("struct<a:b:string,plain:int,nested:c:struct<inner:int>>")
    children = parsed["children"]

    assert [child["name"] for child in children] == ["a:b", "plain", "nested:c"]
    assert children[0]["dataType"] == "STRING"
    assert children[1]["dataType"] == "INT"
    assert children[2]["dataType"] == "STRUCT"
    assert children[2]["children"][0]["name"] == "inner"


def test_struct_field_without_colon_still_raises():
    """A field with no ':' at all is still an invalid struct field format."""
    with pytest.raises(ValueError, match="field_name:field_type"):
        ColumnTypeParser._parse_datatype_string("struct<justaname>")


class TestDecimalPrecisionContract:
    """`dataLength` is the length of a char/varchar/binary (entity/data/table.json), so a numeric's
    digits belong in `precision` and `scale`.

    Connectors splat this dict straight into `Column`, so the keys emitted here are the contract
    every one of them depends on - glue, athena, deltalake, unitycatalog, amundsen, quicksight and
    superset all read it.
    """

    @pytest.mark.parametrize(
        "dtype,precision,scale",
        [
            ("decimal(10,2)", 10, 2),
            ("numeric(38,10)", 38, 10),
            ("decimal(10, 2)", 10, 2),
            ("decimal(10)", 10, None),
            ("decimal", None, None),
        ],
        ids=["decimal", "numeric", "spaced", "precision_only", "bare"],
    )
    def test_precision_and_scale_are_emitted(self, dtype, precision, scale):
        parsed = ColumnTypeParser._parse_datatype_string(dtype)

        assert parsed.get("precision") == precision
        assert parsed.get("scale") == scale

    @pytest.mark.parametrize(
        "dtype",
        ["decimal(10,2)", "numeric(38,10)", "decimal(10)", "decimal"],
    )
    def test_a_numeric_never_reports_a_character_length(self, dtype):
        """Reporting precision as dataLength is what made Glue decimals look like fixed-width text."""
        assert "dataLength" not in ColumnTypeParser._parse_datatype_string(dtype)

    @pytest.mark.parametrize("dtype,length", [("varchar(50)", 50), ("char(10)", 10)])
    def test_character_length_is_unaffected(self, dtype, length):
        parsed = ColumnTypeParser._parse_datatype_string(dtype)

        assert parsed["dataLength"] == length
        assert "precision" not in parsed

    def test_the_display_string_is_preserved(self):
        assert ColumnTypeParser._parse_datatype_string("decimal(10,2)")["dataTypeDisplay"] == "decimal(10,2)"

    def test_a_nested_decimal_child_carries_precision(self):
        child = ColumnTypeParser._parse_datatype_string("struct<amount:decimal(10,2)>")["children"][0]

        assert (child["precision"], child["scale"]) == (10, 2)
        assert "dataLength" not in child

    def test_an_array_of_decimal_is_unchanged(self):
        parsed = ColumnTypeParser._parse_datatype_string("array<decimal(10,2)>")

        assert parsed["dataType"] == "ARRAY"
        assert parsed["arrayDataType"] == "DECIMAL"
