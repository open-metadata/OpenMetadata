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
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.static.column_names import ColumnNames
from metadata.profiler.orm.converter.azuresql.converter import AzureSqlMapTypes
from metadata.profiler.orm.converter.base import _safe_orm_attr, ometa_to_sqa_orm
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


@patch("metadata.profiler.orm.converter.base.get_orm_schema", return_value="schema")
@patch("metadata.profiler.orm.converter.base.get_orm_database", return_value="database")
def test_dunder_prefixed_columns_are_mapped(mock_schema, mock_database):
    """Columns whose names begin with __ or _sa_ are filtered by SQLAlchemy 2.x's
    declarative scan and silently dropped from the mapped Table.  When the dropped
    column is the first one it also carries the synthetic primary key, causing a hard
    mapper error (see #32508).  ometa_to_sqa_orm must remap such names to a safe
    class-attribute key so every column reaches the ORM table.
    """
    column_definition = [
        ("__hevo_id", DataType.STRING),  # dunder prefix — is the PK, must not be dropped
        ("normal_col", DataType.INT),
        ("_sa_special", DataType.STRING),  # _sa_ prefix — also filtered by SQLAlchemy
    ]

    columns = [Column(name=name, dataType=data_type) for name, data_type in column_definition]

    table = Table(
        id=UUID("1f8c1222-09a0-11ed-871b-ca4e864bb16a"),
        name="dunder_test_table",
        columns=columns,
        serviceType=DatabaseServiceType.BigQuery,
    )

    orm_table = ometa_to_sqa_orm(table, None)

    # Every column must appear in the underlying Table under its original name
    assert [col.name for col in orm_table.__table__.columns] == [name for name, _ in column_definition]
    with sqlalchemy.create_engine("sqlite://").connect() as connection:
        reported_names = connection.execute(
            sqlalchemy.select(add_props(table=orm_table)(ColumnNames)().fn())
        ).scalar_one()
    assert reported_names.split(",") == [name for name, _ in column_definition]
    # The first column (dunder-prefixed) must be the primary key
    pk_cols = list(orm_table.__table__.primary_key)
    assert len(pk_cols) == 1
    assert pk_cols[0].name == "__hevo_id"


def test_safe_orm_attr_collision_between_normal_and_remapped_dunder():
    """A normal column named exactly like a remapped dunder key must not collide.

    If a table has both ``__hevo_id`` (remapped to ``om_col___hevo_id``) and a
    real column literally named ``om_col___hevo_id``, _safe_orm_attr must yield
    distinct keys for both so neither column is silently overwritten.
    """
    existing: set = set()

    # The real column arrives first and claims "om_col___hevo_id".
    real_key = _safe_orm_attr("om_col___hevo_id", existing)
    existing.add(real_key)
    assert real_key == "om_col___hevo_id"

    # The dunder column is remapped — its initial candidate collides, so it
    # must get an extra underscore suffix.
    dunder_key = _safe_orm_attr("__hevo_id", existing)
    existing.add(dunder_key)
    assert dunder_key == "om_col___hevo_id_"

    # Both keys are distinct — no column was silently overwritten.
    assert real_key != dunder_key


@mark.parametrize("service_type", [DatabaseServiceType.Mssql, DatabaseServiceType.AzureSQL])
@mark.parametrize("table_type", ["Regular", "View"])
@mark.parametrize(
    "schema_name, sql_schema",
    [
        ("sales.archive", "[sales.archive]"),
        ("sales.archive.history", "[sales.archive.history]"),
        ("sales].archive", "[sales]].archive]"),
        ("sales[archive]", "[sales[archive]]]"),
        ("dbo", "[dbo]"),
    ],
)
def test_literal_tsql_schema_qualification(service_type, table_type, schema_name, sql_schema):
    from sqlalchemy.dialects.mssql import dialect

    from metadata.profiler.processor.runner import QueryRunner

    table, metadata = _catalog_table(service_type, schema_name, table_type)
    orm = ometa_to_sqa_orm(table, metadata, sqlalchemy.MetaData())
    statement = sqlalchemy.select(orm.id)

    assert str(statement.compile(dialect=dialect())) == f"SELECT {sql_schema}.orders.id \nFROM {sql_schema}.orders"
    runner = QueryRunner(session=None, dataset=orm, raw_dataset=orm)
    assert runner.schema_name == schema_name


def _catalog_table(service_type, schema_name, table_type="Regular"):
    from unittest.mock import MagicMock

    from metadata.generated.schema.entity.data.database import Database
    from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

    database = Database(id=UUID(int=1), name="catalog", service={"id": str(UUID(int=2)), "type": "databaseService"})
    schema = DatabaseSchema(
        id=UUID(int=3),
        name=schema_name,
        service=database.service,
        database={"id": str(database.id.root), "type": "database"},
    )
    table = Table(
        id=UUID(int=4),
        name="orders",
        columns=[Column(name="id", dataType=DataType.INT)],
        serviceType=service_type,
        tableType=table_type,
        database={"id": str(database.id.root), "type": "database"},
        databaseSchema={"id": str(schema.id.root), "type": "databaseSchema"},
    )
    metadata = MagicMock(spec=OpenMetadata)
    metadata.get_by_id.side_effect = lambda *, entity, entity_id, nullable: {
        Database: database,
        DatabaseSchema: schema,
    }[entity]
    return table, metadata


@mark.parametrize(
    "service_type, schema_name, expected_schema",
    [
        (DatabaseServiceType.Postgres, "sales.archive", '"sales.archive"'),
        (DatabaseServiceType.Trino, "catalog.sales", '"catalog.sales"'),
        (DatabaseServiceType.Snowflake, "MixedCase", '"MixedCase"'),
        (DatabaseServiceType.Snowflake, "UPPERCASE", '"UPPERCASE"'),
    ],
)
def test_schema_quoting_preserves_other_dialect_defaults(service_type, schema_name, expected_schema):
    from sqlalchemy.dialects.postgresql import dialect as postgres_dialect
    from trino.sqlalchemy.dialect import TrinoDialect

    dialects = {
        DatabaseServiceType.Postgres: postgres_dialect,
        DatabaseServiceType.Trino: TrinoDialect,
        DatabaseServiceType.Snowflake: snowflake_dialect,
    }
    table, metadata = _catalog_table(service_type, schema_name)
    orm = ometa_to_sqa_orm(table, metadata, sqlalchemy.MetaData())
    sql = str(sqlalchemy.select(orm.id).compile(dialect=dialects[service_type]()))
    sql_table = '"orders"' if service_type == DatabaseServiceType.Snowflake else "orders"
    assert f"FROM {expected_schema}.{sql_table}" in sql
    expected_quote = True if service_type == DatabaseServiceType.Snowflake and schema_name == "MixedCase" else None
    assert orm.__table__.schema.quote is expected_quote
    assert orm.__table__.schema == schema_name


@mark.parametrize("service_type", [DatabaseServiceType.Mssql, DatabaseServiceType.AzureSQL])
@mark.parametrize("table_type", ["Regular", "View"])
def test_production_tsql_sampler_qualifies_literal_schema(service_type, table_type):
    from sqlalchemy.dialects.mssql import dialect

    from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import AzureSQLConnection
    from metadata.generated.schema.entity.services.connections.database.mssqlConnection import MssqlConnection
    from metadata.generated.schema.type.basic import ProfileSampleType
    from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
    from metadata.sampler.sqlalchemy.azuresql.sampler import AzureSQLSampler
    from metadata.sampler.sqlalchemy.mssql.sampler import MssqlSampler

    entity, metadata = _catalog_table(service_type, "sales.archive", table_type)
    connection_type, sampler_type = (
        (MssqlConnection, MssqlSampler)
        if service_type == DatabaseServiceType.Mssql
        else (AzureSQLConnection, AzureSQLSampler)
    )
    engine = sqlalchemy.create_engine("sqlite://")
    try:
        with patch("metadata.sampler.sqlalchemy.sampler.get_ssl_connection", return_value=engine):
            sampler = sampler_type(
                service_connection_config=connection_type(
                    username="fixture", password="fixture", hostPort="localhost:1433", database="catalog"
                ),
                ometa_client=metadata,
                entity=entity,
            )
        static = StaticSamplingConfig(profileSample=100, profileSampleType=ProfileSampleType.PERCENTAGE)
        sql = str(sampler.get_sample_query(static).compile(dialect=dialect()))
        assert "FROM [sales.archive].orders" in sql
        assert ("TABLESAMPLE" in sql) == (table_type == "Regular")
        assert sampler.raw_dataset.__table__.schema == "sales.archive"
    finally:
        engine.dispose()
