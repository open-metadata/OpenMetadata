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
"""StarRocks nested (STRUCT/ARRAY/MAP) column type parsing"""

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.ingestion.source.database.column_helpers import (
    column_from_parsed,
    parse_complex_column_type,
)
from metadata.ingestion.source.database.starrocks.metadata import _get_column

LOCATION_TYPE = (
    "struct<latitude double, longitude double, borough varchar(32), zip varchar(16), "
    "address struct<street varchar(64), cross_street varchar(64)>>"
)
VEHICLES_TYPE = (
    "array<struct<type varchar(64), persons_injured int(11), persons_killed int(11), contributing_factor varchar(64)>>"
)


class TestParseComplexType:
    """_parse_complex_type on the type strings SHOW FULL COLUMNS returns"""

    def test_flat_struct_children(self):
        parsed = parse_complex_column_type("struct<latitude double, longitude double>")
        assert parsed is not None
        assert parsed["dataType"] == DataType.STRUCT.value
        by_name = {c["name"]: c for c in parsed["children"]}
        assert by_name["latitude"]["dataType"] == DataType.DOUBLE.value
        assert by_name["longitude"]["dataType"] == DataType.DOUBLE.value

    def test_two_level_nesting(self):
        parsed = parse_complex_column_type(LOCATION_TYPE)
        assert parsed is not None
        by_name = {c["name"]: c for c in parsed["children"]}
        assert len(by_name) == 5
        address = by_name["address"]
        assert address["dataType"] == DataType.STRUCT.value
        addr_children = {c["name"]: c for c in address["children"]}
        assert addr_children["street"]["dataType"] == DataType.VARCHAR.value
        assert addr_children["cross_street"]["dataType"] == DataType.VARCHAR.value
        assert by_name["latitude"]["dataType"] == DataType.DOUBLE.value

    def test_array_of_struct(self):
        parsed = parse_complex_column_type(VEHICLES_TYPE)
        assert parsed is not None
        assert parsed["dataType"] == DataType.ARRAY.value
        assert parsed["arrayDataType"] == DataType.STRUCT.value
        children = {c["name"]: c for c in parsed["children"]}
        assert set(children) == {"type", "persons_injured", "persons_killed", "contributing_factor"}
        assert children["persons_injured"]["dataType"] == DataType.INT.value

    def test_decimal_keep_precision(self):
        parsed = parse_complex_column_type("struct<amount decimal(10, 2)>")
        assert parsed is not None
        child = parsed["children"][0]
        assert child["dataType"] == DataType.DECIMAL.value
        assert child["precision"] == 10
        assert child["scale"] == 2

    def test_map_has_no_children(self):
        parsed = parse_complex_column_type("map<varchar(10), int>")
        assert parsed is not None
        assert parsed["dataType"] == DataType.MAP.value

    def test_array_of_primitive_keeps_element_type(self):
        parsed = parse_complex_column_type("array<bigint>")
        assert parsed is not None
        assert parsed["dataType"] == DataType.ARRAY.value
        assert parsed["arrayDataType"] == DataType.BIGINT.value

    def test_primitive_returns_none(self):
        assert parse_complex_column_type("varchar(64)") is None
        assert parse_complex_column_type("double") is None

    def test_malformed_type_returns_none(self):
        assert parse_complex_column_type("struct<broken") is None


class TestGetColumnChildren:
    """_get_column carries parsed children in its dict"""

    def test_struct_children_present(self):
        column = _get_column(0, "location", LOCATION_TYPE, "YES", None, "")
        assert column["system_data_type"] == DataType.STRUCT.value
        assert len(column["children"]) == 5
        assert column["children"][4]["name"] == "address"
        assert len(column["children"][4]["children"]) == 2

    def test_array_of_struct_children_present(self):
        column = _get_column(0, "vehicles", VEHICLES_TYPE, "YES", None, "")
        assert column["system_data_type"] == DataType.ARRAY.value
        assert column["arr_data_type"] == "STRUCT"
        assert len(column["children"]) == 4

    def test_primitive_column_has_no_children(self):
        column = _get_column(0, "collision_id", "bigint", "NO", None, "")
        assert column["children"] is None


class TestChildColumn:
    """_child_column maps a parsed child dict onto the Column entity"""

    def test_nested_children_are_columns(self):
        parsed = parse_complex_column_type(LOCATION_TYPE)
        address_dict = parsed["children"][4]
        column = column_from_parsed(4, address_dict)
        assert column.name.root == "address"

    def test_child_column_recursion(self):
        parsed = parse_complex_column_type(LOCATION_TYPE)
        by_name = {}
        for ordinal, child in enumerate(parsed["children"]):
            by_name[child["name"]] = column_from_parsed(ordinal, child)
        address = by_name["address"]
        assert isinstance(address, Column)
        assert len(address.children) == 2
        assert address.children[0].name.root == "street"
        assert address.children[0].dataType == DataType.VARCHAR
        assert address.children[0].dataTypeDisplay  # never empty
        assert address.children[0].children is None

    def test_child_column_ordinal(self):
        parsed = parse_complex_column_type(LOCATION_TYPE)
        first = column_from_parsed(0, parsed["children"][0])
        assert first.ordinalPosition == 0

    def test_child_column_decimal_precision(self):
        parsed = parse_complex_column_type("struct<amount decimal(10, 2)>")
        amount = column_from_parsed(0, parsed["children"][0])
        assert amount.precision == 10
        assert amount.scale == 2
