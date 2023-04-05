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
Test ometa to orm converter
"""

from unittest.mock import patch
from uuid import UUID

from pytest import mark
from sqlalchemy import Column as SQAColumn
from sqlalchemy.sql.sqltypes import INTEGER, String

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.profiler.orm.converter import get_columns, ometa_to_sqa_orm


@patch("metadata.profiler.orm.converter.get_orm_schema", return_value="schema")
@patch("metadata.profiler.orm.converter.get_orm_database", return_value="database")
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
def test_snowflake_case_sensitive_orm(
    mock_schema, mock_database, column_definition, table_name
):
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
    assert [
        name.lower() for name, _ in column_definition
    ] == orm_table.__table__.columns.keys()
    assert orm_table.__tablename__ == table_name
    assert orm_table.__table_args__["schema"] == "schema"
    for name, _ in column_definition:
        assert hasattr(orm_table, name)


@patch("metadata.profiler.orm.converter.get_orm_schema", return_value="schema")
@patch("metadata.profiler.orm.converter.get_orm_database", return_value="database")
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
    assert [
        name.lower() for name, _ in column_definition
    ] == orm_table.__table__.columns.keys()
    assert orm_table.__tablename__ == table_name
    assert orm_table.__table_args__["schema"] == "schema"
    for name, _ in column_definition:
        assert hasattr(orm_table, name)


def test_get_columns_regular():
    """Test get columns function reads columns correctly"""
    regular_columns = [
        Column(
            name="col1",
            dataType=DataType.STRING,
        ),
        Column(
            name="col2",
            dataType=DataType.INT,
        ),
    ]

    cols = get_columns(regular_columns, DatabaseServiceType.BigQuery)
    col1 = cols["col1"]
    col2 = cols["col2"]
    assert len(cols) == 2
    assert col1.name == "col1"
    assert isinstance(col1.type, String)
    assert col2.name == "col2"
    assert isinstance(col2.type, INTEGER)


def test_get_columns_struct():
    """Test get columns function reads columns correctly for struct"""
    struct_columns = [
        Column(
            name="col1",
            dataType=DataType.STRING,
        ),
        Column(
            name="col2",
            dataType=DataType.STRUCT,
            children=[
                Column(
                    name="structCol1",
                    dataType=DataType.STRING,
                ),
                Column(
                    name="structCol2",
                    dataType=DataType.STRUCT,
                    children=[
                        Column(
                            name="nestedStructCol1",
                            dataType=DataType.STRING,
                        ),
                    ],
                ),
            ],
        ),
    ]

    cols = get_columns(struct_columns, DatabaseServiceType.BigQuery)
    assert len(cols) == 5
    assert "col2.structCol1" in cols
    assert "col2.structCol2" in cols
    assert "col2.structCol2.nestedStructCol1" in cols
