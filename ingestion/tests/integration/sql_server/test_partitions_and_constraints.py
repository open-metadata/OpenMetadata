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
Real-server regression coverage for three MSSQL gaps fixed together: partitioned
tables were never detected (no `get_table_partition_details` override), named
UNIQUE constraints were silently dropped (`get_unique_constraints` was a
`NotImplementedError` stub), and `FUNCTION`s were missing from routine discovery.

Runs each production entry point directly against a real SQL Server instance,
same style as `test_stored_procedures_fanout.py` -- no full `MetadataWorkflow`
run needed for a narrow, targeted regression check.
"""

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.dialects.mssql.base import MSDialect
from sqlalchemy.engine.url import make_url

from metadata.generated.schema.entity.data.table import PartitionIntervalTypes
from metadata.ingestion.source.database.mssql.metadata import MssqlSource
from metadata.ingestion.source.database.mssql.queries import MSSQL_GET_STORED_PROCEDURES
from metadata.ingestion.source.database.mssql.utils import get_unique_constraints

REPORTING_SCHEMA = "reporting"


@pytest.fixture(scope="module")
def mssql_engine(mssql_container, db_name):
    url = make_url("mssql+pytds://" + mssql_container.get_connection_url().split("://")[1]).set(database=db_name)
    engine = create_engine(url, connect_args={"autocommit": True})

    with engine.connect() as conn:
        conn.execute(text(f"IF SCHEMA_ID('{REPORTING_SCHEMA}') IS NULL EXEC('CREATE SCHEMA {REPORTING_SCHEMA}')"))

        # A RANGE-partitioned heap table in dbo, keyed on an int column.
        conn.execute(text("IF OBJECT_ID('dbo.PartitionedSales') IS NOT NULL DROP TABLE dbo.PartitionedSales"))
        conn.execute(
            text(
                "IF EXISTS (SELECT 1 FROM sys.partition_schemes WHERE name = 'ps_sales_by_id') "
                "DROP PARTITION SCHEME ps_sales_by_id"
            )
        )
        conn.execute(
            text(
                "IF EXISTS (SELECT 1 FROM sys.partition_functions WHERE name = 'pf_sales_by_id') "
                "DROP PARTITION FUNCTION pf_sales_by_id"
            )
        )
        conn.execute(text("CREATE PARTITION FUNCTION pf_sales_by_id (INT) AS RANGE LEFT FOR VALUES (1000, 2000)"))
        conn.execute(text("CREATE PARTITION SCHEME ps_sales_by_id AS PARTITION pf_sales_by_id ALL TO ([PRIMARY])"))
        conn.execute(
            text(
                "CREATE TABLE dbo.PartitionedSales (SaleId INT NOT NULL, Amount DECIMAL(10,2)) "
                "ON ps_sales_by_id(SaleId)"
            )
        )

        # Same table name in a different schema, not partitioned -- proves the
        # (schema_name, table_name) lookup key doesn't cross schema boundaries.
        conn.execute(
            text(
                f"IF OBJECT_ID('{REPORTING_SCHEMA}.PartitionedSales') IS NOT NULL DROP TABLE {REPORTING_SCHEMA}.PartitionedSales"
            )
        )
        conn.execute(
            text(f"CREATE TABLE {REPORTING_SCHEMA}.PartitionedSales (SaleId INT NOT NULL, Amount DECIMAL(10,2))")
        )

        # Single-column named UNIQUE constraint.
        conn.execute(text("IF OBJECT_ID('dbo.Products') IS NOT NULL DROP TABLE dbo.Products"))
        conn.execute(
            text(
                "CREATE TABLE dbo.Products (ProductId INT NOT NULL, SKU VARCHAR(50) NOT NULL, "
                "CONSTRAINT UQ_Products_SKU UNIQUE (SKU))"
            )
        )

        # Multi-column (compound) named UNIQUE constraint.
        conn.execute(text("IF OBJECT_ID('dbo.OrderLines') IS NOT NULL DROP TABLE dbo.OrderLines"))
        conn.execute(
            text(
                "CREATE TABLE dbo.OrderLines (OrderId INT NOT NULL, ProductId INT NOT NULL, "
                "CONSTRAINT UQ_OrderLines_OrderProduct UNIQUE (OrderId, ProductId))"
            )
        )

        # A scalar FUNCTION, which MSSQL_GET_STORED_PROCEDURES must surface
        # alongside PROCEDUREs (it used to query sys.procedures only).
        conn.execute(text("IF OBJECT_ID('dbo.ufn_double') IS NOT NULL DROP FUNCTION dbo.ufn_double"))
        conn.execute(text("CREATE FUNCTION dbo.ufn_double(@x INT) RETURNS INT AS BEGIN RETURN @x * 2 END"))

    yield engine

    with engine.connect() as conn:
        conn.execute(text("IF OBJECT_ID('dbo.ufn_double') IS NOT NULL DROP FUNCTION dbo.ufn_double"))
        conn.execute(text("IF OBJECT_ID('dbo.OrderLines') IS NOT NULL DROP TABLE dbo.OrderLines"))
        conn.execute(text("IF OBJECT_ID('dbo.Products') IS NOT NULL DROP TABLE dbo.Products"))
        conn.execute(
            text(
                f"IF OBJECT_ID('{REPORTING_SCHEMA}.PartitionedSales') IS NOT NULL DROP TABLE {REPORTING_SCHEMA}.PartitionedSales"
            )
        )
        conn.execute(text("IF OBJECT_ID('dbo.PartitionedSales') IS NOT NULL DROP TABLE dbo.PartitionedSales"))
        conn.execute(
            text(
                "IF EXISTS (SELECT 1 FROM sys.partition_schemes WHERE name = 'ps_sales_by_id') "
                "DROP PARTITION SCHEME ps_sales_by_id"
            )
        )
        conn.execute(
            text(
                "IF EXISTS (SELECT 1 FROM sys.partition_functions WHERE name = 'pf_sales_by_id') "
                "DROP PARTITION FUNCTION pf_sales_by_id"
            )
        )
    engine.dispose()


@pytest.fixture()
def partition_source(mssql_engine):
    """A minimal MssqlSource carrying only what set_partition_details_map/
    get_table_partition_details need, pointed at the real container."""
    source = MssqlSource.__new__(MssqlSource)
    source.partition_details_map = {}
    source.engine = mssql_engine
    source.set_partition_details_map()
    return source


def test_partitioned_table_reports_correct_column_and_interval_type(partition_source):
    is_partitioned, partition_details = partition_source.get_table_partition_details(
        table_name="PartitionedSales", schema_name="dbo", inspector=None
    )

    assert is_partitioned is True
    assert partition_details.columns[0].columnName == "SaleId"
    assert partition_details.columns[0].intervalType == PartitionIntervalTypes.INTEGER_RANGE
    assert partition_details.columns[0].interval is None


def test_same_named_table_in_other_schema_is_not_marked_partitioned(partition_source):
    """dbo.PartitionedSales is partitioned; reporting.PartitionedSales (same
    table name, different schema, not partitioned) must not inherit it."""
    is_partitioned, partition_details = partition_source.get_table_partition_details(
        table_name="PartitionedSales", schema_name=REPORTING_SCHEMA, inspector=None
    )

    assert (is_partitioned, partition_details) == (False, None)


def test_single_column_unique_constraint_is_reflected(mssql_engine):
    with mssql_engine.connect() as connection:
        constraints = get_unique_constraints(MSDialect(), connection, "Products", schema="dbo")

    assert constraints == [{"name": "UQ_Products_SKU", "column_names": ["SKU"]}]


def test_multi_column_unique_constraint_is_reflected(mssql_engine):
    with mssql_engine.connect() as connection:
        constraints = get_unique_constraints(MSDialect(), connection, "OrderLines", schema="dbo")

    assert constraints == [{"name": "UQ_OrderLines_OrderProduct", "column_names": ["OrderId", "ProductId"]}]


def test_function_is_detected_with_routine_type_function(mssql_engine, db_name):
    query = MSSQL_GET_STORED_PROCEDURES.format(database_name=db_name, schema_name="dbo")
    with mssql_engine.connect() as conn:
        rows = {row.name: row.routine_type for row in conn.execute(text(query)).all()}

    assert rows.get("ufn_double") == "FUNCTION"
