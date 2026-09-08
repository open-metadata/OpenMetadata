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
Test ometa to orm converter
"""

from unittest.mock import patch
from uuid import UUID

import sqlalchemy
from pytest import mark
from snowflake.sqlalchemy import dialect as snowflake_dialect

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.profiler.orm.converter.azuresql.converter import AzureSqlMapTypes
from metadata.profiler.orm.converter.base import ometa_to_sqa_orm
from metadata.profiler.orm.converter.common import CommonMapTypes
from metadata.profiler.orm.converter.mssql.converter import MssqlMapTypes
from metadata.profiler.orm.registry import CustomTypes


@patch("metadata.profiler.orm.converter.base.get_orm_schema", return_value="schema")
@patch("metadata.profiler.orm.converter.base.get_orm_database", return_value="database")
@mark.parametrize(
    "column_definition, table_name",
    [
        (
            [
                (
                    "CaseSensitive",
                    DataType.STRING,
                ),
                ("UPPER_CASE", DataType.INT),
            ],
            "table_1",
        ),
        (
            [
                (
                    "all_lower_case",
                    DataType.STRING,
                ),
                ("lower_case", DataType.INT),
            ],
            "table_2",
        ),
    ],
)
def test_snowflake_case_sensitive_orm(mock_schema, mock_database, column_definition, table_name):
    """Test that snowflake case sensitive orm table
    are enforced correctly
    """
    columns = [
        Column(
            name=name,
            dataType=type,
        )
        for name, type in column_definition
    ]

    table = Table(
        id=UUID("1f8c1222-09a0-11ed-871b-ca4e864bb16a"),
        name=table_name,
        columns=columns,
        serviceType=DatabaseServiceType.Snowflake,
    )

    orm_table = ometa_to_sqa_orm(table, None)

    assert orm_table.__table_args__.get("quote")
    assert [name.lower() for name, _ in column_definition] == orm_table.__table__.columns.keys()
    assert orm_table.__tablename__ == table_name
    assert orm_table.__table_args__["schema"] == "schema"
    for name, _ in column_definition:
        assert hasattr(orm_table, name)


@patch("metadata.profiler.orm.converter.base.get_orm_schema", return_value="schema")
@patch("metadata.profiler.orm.converter.base.get_orm_database", return_value="database")
def test_columns_differing_only_in_case(mock_schema, mock_database):
    """Snowflake allows columns that only differ in their casing. We lowercase the
    SQA column key, so such columns used to collide and get dropped from the ORM
    table, making the mapper fail with `column ... is not represented in the
    mapper's table`.
    """
    column_definition = [
        ("id_hotel", DataType.STRING),
        ("Hotel_region", DataType.STRING),
        ("HOTEL_REGION", DataType.STRING),
    ]

    columns = [Column(name=name, dataType=data_type) for name, data_type in column_definition]

    table = Table(
        id=UUID("1f8c1222-09a0-11ed-871b-ca4e864bb16a"),
        name="duplicate_case_table",
        columns=columns,
        serviceType=DatabaseServiceType.Snowflake,
    )

    orm_table = ometa_to_sqa_orm(table, None)

    # Both case variants are mapped, and the original names are kept
    assert [name for name, _ in column_definition] == [col.name for col in orm_table.__table__.columns]
    # Only the non-ambiguous column can be safely keyed by its lowercase name
    assert orm_table.__table__.columns.keys() == ["id_hotel", "Hotel_region", "HOTEL_REGION"]
    for name, _ in column_definition:
        assert hasattr(orm_table, name)


@patch("metadata.profiler.orm.converter.base.get_orm_schema", return_value="lowercase_schema")
@patch("metadata.profiler.orm.converter.base.get_orm_database", return_value="DATABASE")
def test_snowflake_lowercase_schema_is_quoted(mock_schema, mock_database):
    table = Table(
        id=UUID("1f8c1222-09a0-11ed-871b-ca4e864bb16a"),
        name="ALBUM",
        columns=[Column(name="ID", dataType=DataType.INT)],
        serviceType=DatabaseServiceType.Snowflake,
    )

    orm_table = ometa_to_sqa_orm(table, None)

    compiled_query = str(sqlalchemy.select(orm_table).compile(dialect=snowflake_dialect()))
    assert 'FROM "lowercase_schema"."ALBUM"' in compiled_query


@patch("metadata.profiler.orm.converter.base.get_orm_schema", return_value="schema")
@patch("metadata.profiler.orm.converter.base.get_orm_database", return_value="database")
def test_metadata_column(mock_schema, mock_database):
    """Test that snowflake case sensitive orm table
    are enforced correctly
    """
    table_name = "foo"
    column_definition = [
        (
            "foo",
            DataType.STRING,
        ),
        ("metadata", DataType.INT),
    ]

    columns = [
        Column(
            name=name,
            dataType=type,
        )
        for name, type in column_definition
    ]

    table = Table(
        id=UUID("1f8c1222-09a0-11ed-871b-ca4e864bb16a"),
        name=table_name,
        columns=columns,
        serviceType=DatabaseServiceType.BigQuery,
    )

    orm_table = ometa_to_sqa_orm(table, None)

    assert not orm_table.__table_args__.get("quote")
    assert [name.lower() for name, _ in column_definition] == orm_table.__table__.columns.keys()
    assert orm_table.__tablename__ == table_name
    assert orm_table.__table_args__["schema"] == "schema"
    for name, _ in column_definition:
        assert hasattr(orm_table, name)


@patch("metadata.profiler.orm.converter.base.get_orm_schema", return_value="schema")
@patch("metadata.profiler.orm.converter.base.get_orm_database", return_value="database")
@mark.parametrize(
    "service_type, table_name",
    [
        (DatabaseServiceType.Mssql, "mssql_money_and_bit_table"),
        (DatabaseServiceType.AzureSQL, "azuresql_money_and_bit_table"),
    ],
)
def test_money_and_bit_types_are_mapped(mock_schema, mock_database, service_type, table_name):
    """MONEY and BIT columns (e.g. from MSSQL) must resolve to a concrete SQLAlchemy
    type instead of falling back to CustomTypes.UNDETERMINED, which skips profiling
    and renders sample data as the literal string "OPENMETADATA_UNDETERMIND[value]".

    Each case needs its own table name: ometa_to_sqa_orm keys the generated declarative
    class on it, so reusing one collides in the shared registry.
    """
    column_definition = [
        ("amount", DataType.MONEY),
        ("flag", DataType.BIT),
    ]

    columns = [Column(name=name, dataType=data_type) for name, data_type in column_definition]

    table = Table(
        id=UUID("1f8c1222-09a0-11ed-871b-ca4e864bb16a"),
        name=table_name,
        columns=columns,
        serviceType=service_type,
    )

    orm_table = ometa_to_sqa_orm(table, None)

    undetermined_type = CustomTypes.UNDETERMINED.value
    amount_type = orm_table.__table__.columns["amount"].type
    flag_type = orm_table.__table__.columns["flag"].type

    assert not isinstance(amount_type, undetermined_type)
    assert isinstance(amount_type, sqlalchemy.NUMERIC)
    assert not isinstance(flag_type, undetermined_type)
    assert isinstance(flag_type, sqlalchemy.BOOLEAN)


@mark.parametrize("mapper", [MssqlMapTypes, AzureSqlMapTypes])
def test_money_and_bit_reverse_map(mapper):
    """The reverse map drives metric_filter's decision on which metrics to run, so
    MONEY and BIT must be added to the existing entries rather than replacing them.
    """
    reverse_map = mapper.map_sqa_to_om_types()

    assert reverse_map[sqlalchemy.NUMERIC] == {DataType.NUMBER, DataType.NUMERIC, DataType.MONEY}
    assert reverse_map[sqlalchemy.BOOLEAN] == {DataType.BOOLEAN, DataType.BIT}


def test_money_and_bit_stay_out_of_the_common_mapper():
    """These are T-SQL types: mapping them on CommonMapTypes would apply them to every
    connector, including ones where BIT is a bit-string rather than a boolean.
    """
    assert DataType.MONEY not in CommonMapTypes._TYPE_MAP
    assert DataType.BIT not in CommonMapTypes._TYPE_MAP

    common_reverse_map = CommonMapTypes.map_sqa_to_om_types()
    assert DataType.MONEY not in common_reverse_map[sqlalchemy.NUMERIC]
    assert DataType.BIT not in common_reverse_map[sqlalchemy.BOOLEAN]
