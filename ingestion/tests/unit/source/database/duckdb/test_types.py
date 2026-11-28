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
"""DuckDB type strings must reach OpenMetadata as the right data types."""

import pytest
from sqlalchemy import types as sa_types

from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.duckdb.types import (
    DuckDBColumnType,
    parse_duckdb_type,
    sqla_type_for,
)


@pytest.mark.parametrize(
    ("duckdb_type", "om_data_type"),
    [
        ("BIGINT", "BIGINT"),
        ("INTEGER", "INT"),
        ("TINYINT", "TINYINT"),
        ("UTINYINT", "SMALLINT"),
        ("USMALLINT", "INT"),
        ("UINTEGER", "BIGINT"),
        ("UBIGINT", "LARGEINT"),
        ("HUGEINT", "LARGEINT"),
        ("UHUGEINT", "LARGEINT"),
        ("BIGNUM", "NUMERIC"),
        ("DECIMAL(12,2)", "DECIMAL"),
        ("DOUBLE", "DOUBLE"),
        ("FLOAT", "FLOAT"),
        ("BOOLEAN", "BOOLEAN"),
        ("DATE", "DATE"),
        ("TIME", "TIME"),
        ("TIME_NS", "TIME"),
        ("TIME WITH TIME ZONE", "TIME"),
        ("TIMESTAMP", "TIMESTAMP"),
        ("TIMESTAMP_NS", "TIMESTAMP"),
        ("TIMESTAMP_MS", "TIMESTAMP"),
        ("TIMESTAMP_S", "TIMESTAMP"),
        ("TIMESTAMP WITH TIME ZONE", "TIMESTAMP"),
        ("INTERVAL", "INTERVAL"),
        ("VARCHAR", "VARCHAR"),
        ("BLOB", "BLOB"),
        ("BIT", "BIT"),
        ("UUID", "UUID"),
        ("JSON", "JSON"),
        ("VARIANT", "JSON"),
        ("GEOMETRY", "GEOMETRY"),
        ("ENUM('sad', 'ok', 'happy')", "ENUM"),
        ("UNION(phone VARCHAR, ext INTEGER)", "UNION"),
    ],
)
def test_scalar_types_map_to_om_data_types(duckdb_type, om_data_type):
    column_type = parse_duckdb_type(duckdb_type)

    assert column_type.complex_type is None
    assert ColumnTypeParser.get_column_type(column_type.om_type) == om_data_type


def test_decimal_keeps_precision_and_scale():
    column_type = parse_duckdb_type("DECIMAL(12,2)")

    assert ColumnTypeParser.check_col_precision("DECIMAL", column_type.om_type) == ("12", "2")


@pytest.mark.parametrize(
    ("duckdb_type", "expected"),
    [
        ("VARCHAR[]", DuckDBColumnType("ARRAY", "array<VARCHAR>")),
        ("INTEGER[3]", DuckDBColumnType("ARRAY", "array<INTEGER>")),
        ("INTEGER[][]", DuckDBColumnType("ARRAY", "array<array<INTEGER>>")),
        ("UBIGINT[]", DuckDBColumnType("ARRAY", "array<LARGEINT>")),
        ("MAP(VARCHAR, INTEGER[])", DuckDBColumnType("MAP", "map<VARCHAR,array<INTEGER>>")),
        (
            'STRUCT(street VARCHAR, "zip code" VARCHAR, geo STRUCT(lat DOUBLE, lon DOUBLE))',
            DuckDBColumnType("STRUCT", "struct<street:VARCHAR,`zip code`:VARCHAR,geo:struct<lat:DOUBLE,lon:DOUBLE>>"),
        ),
        (
            "STRUCT(order_id BIGINT, total DECIMAL(10,2))[]",
            DuckDBColumnType("ARRAY", "array<struct<order_id:BIGINT,total:DECIMAL(10,2)>>"),
        ),
        (
            "STRUCT(kind ENUM('a, b', 'c'), seen TIMESTAMP WITH TIME ZONE)",
            DuckDBColumnType("STRUCT", "struct<kind:ENUM,seen:TIMESTAMPTZ>"),
        ),
    ],
)
def test_nested_types_are_rewritten_for_the_shared_parser(duckdb_type, expected):
    assert parse_duckdb_type(duckdb_type) == expected


def test_struct_fields_become_child_columns():
    parsed = ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
        parse_duckdb_type('STRUCT(street VARCHAR, "zip code" VARCHAR, geo STRUCT(lat DOUBLE, lon DOUBLE))').complex_type
    )

    assert parsed["dataType"] == "STRUCT"
    assert [(child["name"], child["dataType"]) for child in parsed["children"]] == [
        ("street", "VARCHAR"),
        ("zipcode", "VARCHAR"),
        ("geo", "STRUCT"),
    ]
    assert [(child["name"], child["dataType"]) for child in parsed["children"][2]["children"]] == [
        ("lat", "DOUBLE"),
        ("lon", "DOUBLE"),
    ]


def test_list_of_structs_keeps_item_type_and_children():
    parsed = ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
        parse_duckdb_type("STRUCT(order_id BIGINT, total DECIMAL(10,2))[]").complex_type
    )

    assert parsed["dataType"] == "ARRAY"
    assert parsed["arrayDataType"] == "STRUCT"
    assert [(child["name"], child["dataType"]) for child in parsed["children"]] == [
        ("order_id", "BIGINT"),
        ("total", "DECIMAL"),
    ]


def test_malformed_nested_type_falls_back_to_its_base_type():
    assert parse_duckdb_type('STRUCT("unterminated VARCHAR)') == DuckDBColumnType("STRUCT")


@pytest.mark.parametrize(
    ("duckdb_type", "sqla_type"),
    [
        ("BIGINT", sa_types.BIGINT),
        ("DECIMAL(12,2)", sa_types.NUMERIC),
        ("UBIGINT", sa_types.NUMERIC),
        ("TIMESTAMP_NS", sa_types.TIMESTAMP),
        ("VARCHAR[]", sa_types.VARCHAR),
        ("STRUCT(a INTEGER)", sa_types.VARCHAR),
    ],
)
def test_sqlalchemy_type_for_reflection_consumers(duckdb_type, sqla_type):
    assert isinstance(sqla_type_for(duckdb_type), sqla_type)
