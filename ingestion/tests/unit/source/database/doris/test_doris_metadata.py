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
"""Doris nested (STRUCT/ARRAY/MAP) column type parsing"""

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.ingestion.source.database.column_helpers import (
    column_from_parsed,
    parse_complex_column_type,
)
from metadata.ingestion.source.database.doris.metadata import _get_column

# Doris prints struct fields colon-separated ("s_id:int(11)"); space form
# ("s_id int(11)") is StarRocks dialect — the parser must accept both.
LOCATION_TYPE_COLON = (
    "struct<latitude:double, longitude:double, borough:varchar(32), zip:varchar(16), "
    "address struct<street:varchar(64), cross_street:varchar(64)>>"
)
LOCATION_TYPE_SPACE = (
    "struct<latitude double, longitude double, borough varchar(32), zip varchar(16), "
    "address struct<street varchar(64), cross_street varchar(64)>>"
)
VEHICLES_TYPE_COLON = (
    "array<struct<type:varchar(64), persons_injured:int(11), persons_killed:int(11), contributing_factor:varchar(64)>>"
)


class TestParseComplexType:
    """_parse_complex_type on both colon and space field separators"""

    def test_colon_form_two_level_nesting(self):
        parsed = parse_complex_column_type(LOCATION_TYPE_COLON)
        assert parsed is not None
        assert parsed["dataType"] == DataType.STRUCT.value
        by_name = {c["name"]: c for c in parsed["children"]}
        assert len(by_name) == 5
        address = by_name["address"]
        assert address["dataType"] == DataType.STRUCT.value
        assert len(address["children"]) == 2
        assert {c["name"] for c in address["children"]} == {"street", "cross_street"}

    def test_space_form_two_level_nesting(self):
        parsed = parse_complex_column_type(LOCATION_TYPE_SPACE)
        assert parsed is not None
        by_name = {c["name"]: c for c in parsed["children"]}
        assert by_name["latitude"]["dataType"] == DataType.DOUBLE.value
        assert by_name["address"]["children"][0]["name"] == "street"

    def test_colon_form_array_of_struct(self):
        parsed = parse_complex_column_type(VEHICLES_TYPE_COLON)
        assert parsed is not None
        assert parsed["dataType"] == DataType.ARRAY.value
        assert parsed["arrayDataType"] == DataType.STRUCT.value
        assert len(parsed["children"]) == 4

    def test_decimal_in_struct(self):
        parsed = parse_complex_column_type("struct<amount decimal(10, 2)>")
        assert parsed is not None
        child = parsed["children"][0]
        assert child["dataType"] == DataType.DECIMAL.value
        assert child["precision"] == 10
        assert child["scale"] == 2

    def test_primitive_returns_none(self):
        assert parse_complex_column_type("varchar(64)") is None
        assert parse_complex_column_type("double") is None
        assert parse_complex_column_type("datetime") is None


class TestGetColumnChildren:
    """_get_column carries parsed children in its dict instead of crashing"""

    def test_struct_children_present(self):
        column = _get_column(0, "location", LOCATION_TYPE_COLON, "YES", None, "")
        assert column["system_data_type"] == DataType.STRUCT.value
        assert len(column["children"]) == 5

    def test_scalar_struct_field_keeps_type(self):
        column = _get_column(0, "location", LOCATION_TYPE_COLON, "YES", None, "")
        latitude = next(c for c in column["children"] if c["name"] == "latitude")
        assert latitude["dataType"] == DataType.DOUBLE.value

    def test_v2_and_largeint_struct_fields_keep_type(self):
        # Must match the types the pre-parser connector code produced, or the server
        # re-adds every existing child (columnMatch includes dataType) and drops its
        # custom properties.
        column = _get_column(0, "c", "struct<a:datev2,b:datetimev2(3),c:largeint,d:decimalv3(10,2)>", "YES", None, "")
        assert [child["dataType"] for child in column["children"]] == [
            DataType.DATE.value,
            DataType.DATETIME.value,
            DataType.LARGEINT.value,
            DataType.DECIMAL.value,
        ]

    def test_v2_and_largeint_array_struct_fields_keep_type(self):
        column = _get_column(0, "c", "array<struct<a:datev2,b:largeint>>", "YES", None, "")
        assert [child["dataType"] for child in column["children"]] == [
            DataType.DATE.value,
            DataType.LARGEINT.value,
        ]

    def test_primitive_column_has_no_children(self):
        column = _get_column(0, "collision_id", "bigint", "NO", None, "")
        assert column["children"] is None


class TestChildColumn:
    def test_child_column_recursion(self):
        parsed = parse_complex_column_type(LOCATION_TYPE_COLON)
        address = column_from_parsed(4, parsed["children"][4])
        assert isinstance(address, Column)
        assert len(address.children) == 2
        assert address.children[0].name.root == "street"
        assert address.children[0].dataType == DataType.VARCHAR
