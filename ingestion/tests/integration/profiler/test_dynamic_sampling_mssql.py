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
Sampler-level integration tests for MSSQL dynamic sampling.
Tests _get_asset_row_count accuracy and sampling query execution against a real SQL Server.
No OpenMetadata server required — only MSSQL container.
"""

from unittest.mock import MagicMock

import pytest
from sqlalchemy import Column, Integer, String, create_engine, text
from sqlalchemy.orm import DeclarativeBase
from testcontainers.mssql import SqlServerContainer

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.dynamicSamplingConfig import (
    DynamicSamplingConfig,
    Threshold,
)
from metadata.generated.schema.type.samplingConfig import (
    ProfileSampleConfig,
    SampleConfigType,
)
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.profiler.orm.functions.table_metric_computer import (
    MSSQLTableMetricComputer,
)
from metadata.profiler.processor.runner import QueryRunner
from metadata.sampler.config import resolve_static_sampling_config


class Base(DeclarativeBase):
    pass


class MssqlSamplingTestTable(Base):
    __tablename__ = "sampling_test"
    __table_args__ = {"schema": "dbo"}  # noqa: RUF012
    id = Column(Integer, primary_key=True)
    name = Column(String(256))


ROW_COUNT = 500


@pytest.fixture(scope="module")
def mssql_engine():
    container = SqlServerContainer("mcr.microsoft.com/mssql/server:2022-latest", dbname="master")
    with container as container:
        url = "mssql+pytds://" + container.get_connection_url().split("://")[1]
        engine = create_engine(url, connect_args={"autocommit": True})
        with engine.connect() as conn:
            conn.execute(text("CREATE TABLE dbo.sampling_test (id INT PRIMARY KEY, name NVARCHAR(256))"))
            values = ", ".join(f"({i}, 'row_{i}')" for i in range(1, ROW_COUNT + 1))
            conn.execute(text(f"INSERT INTO dbo.sampling_test (id, name) VALUES {values}"))
        yield engine
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS dbo.sampling_test"))
        engine.dispose()


@pytest.fixture(scope="module")
def mssql_session(mssql_engine):
    session = create_and_bind_session(mssql_engine)
    yield session
    session.close()


class TestMSSQLDynamicSampling:
    """Sampler-level integration tests against a real SQL Server database."""

    def test_row_count_via_metric_computer(self, mssql_session):
        """Verify MSSQLTableMetricComputer returns accurate row count."""
        from metadata.profiler.metrics.registry import Metrics

        runner = QueryRunner(
            session=mssql_session,
            dataset=MssqlSamplingTestTable,
            raw_dataset=MssqlSamplingTestTable,
        )
        entity = MagicMock()
        entity.tableType = TableType.Regular
        entity.name = MagicMock()
        entity.name.root = "sampling_test"
        entity.databaseSchema = MagicMock()
        entity.databaseSchema.name = "dbo"

        computer = MSSQLTableMetricComputer(
            runner=runner,
            metrics=[Metrics.rowCount],
            conn_config=MagicMock(),
            entity=entity,
        )
        computer._set_table_and_schema_name()
        result = computer.compute()
        assert result is not None
        assert result.rowCount == ROW_COUNT

    def test_dynamic_smart_sampling_resolution(self, mssql_session):
        """With 500 rows, smart sampling should resolve to 100% (<=100K tier)."""
        config = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.DYNAMIC,
            config=DynamicSamplingConfig(smartSampling=True),
        )
        static = resolve_static_sampling_config(sample_config=config, row_count=ROW_COUNT)
        assert static is not None
        assert static.profileSample == 100
        assert static.profileSampleType == ProfileSampleType.PERCENTAGE

    def test_dynamic_threshold_resolution(self, mssql_session):
        """Custom threshold at 100 rows → 30% should apply for 500 rows."""
        config = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.DYNAMIC,
            config=DynamicSamplingConfig(
                smartSampling=False,
                thresholds=[
                    Threshold(rowCountThreshold=100, profileSample=30.0),
                ],
            ),
        )
        static = resolve_static_sampling_config(sample_config=config, row_count=ROW_COUNT)
        assert static is not None
        assert static.profileSample == 30.0

    def test_tablesample_percent_executes(self, mssql_session):
        """MSSQL TABLESAMPLE with PERCENT should execute successfully."""
        table = MssqlSamplingTestTable.__table__
        # MSSQL TABLESAMPLE syntax: table TABLESAMPLE (N PERCENT)
        result = mssql_session.execute(
            text(f"SELECT * FROM {table.schema}.{table.name} TABLESAMPLE (50 PERCENT)")
        ).fetchall()
        # MSSQL TABLESAMPLE is page-based, results are approximate
        assert len(result) <= ROW_COUNT

    def test_tablesample_rows_executes(self, mssql_session):
        """MSSQL TABLESAMPLE with ROWS should execute successfully."""
        table = MssqlSamplingTestTable.__table__
        result = mssql_session.execute(
            text(f"SELECT * FROM {table.schema}.{table.name} TABLESAMPLE (100 ROWS)")
        ).fetchall()
        assert len(result) <= ROW_COUNT

    def test_dynamic_threshold_below_returns_none(self, mssql_session):
        """When row count is below all thresholds, resolve returns None."""
        config = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.DYNAMIC,
            config=DynamicSamplingConfig(
                smartSampling=False,
                thresholds=[
                    Threshold(rowCountThreshold=1000, profileSample=10.0),
                ],
            ),
        )
        static = resolve_static_sampling_config(sample_config=config, row_count=ROW_COUNT)
        # 500 < 1000 threshold → no sampling
        assert static is None


@pytest.fixture(scope="module")
def literal_schema_objects(mssql_engine):
    # Independent T-SQL fixture names must not use the converter's quoting policy.
    with mssql_engine.connect() as conn:
        for schema in ("[om37646.sales.archive]", "[om37646_control]"):
            conn.execute(text(f"CREATE SCHEMA {schema}"))
            conn.execute(text(f"CREATE TABLE {schema}.orders (id INT PRIMARY KEY, name NVARCHAR(256))"))
            conn.execute(text(f"INSERT INTO {schema}.orders VALUES (11, 'first'), (29, 'second')"))
            conn.execute(text(f"CREATE VIEW {schema}.orders_view AS SELECT id, name FROM {schema}.orders"))
    yield
    with mssql_engine.connect() as conn:
        for schema in ("[om37646.sales.archive]", "[om37646_control]"):
            conn.execute(text(f"DROP VIEW {schema}.orders_view"))
            conn.execute(text(f"DROP TABLE {schema}.orders"))
            conn.execute(text(f"DROP SCHEMA {schema}"))


@pytest.mark.parametrize("service_type", ["Mssql", "AzureSQL"])
@pytest.mark.parametrize(
    "schema_name, sql_schema",
    [("om37646.sales.archive", "[om37646.sales.archive]"), ("om37646_control", "[om37646_control]")],
)
@pytest.mark.parametrize("table_name, table_type", [("orders", TableType.Regular), ("orders_view", TableType.View)])
def test_literal_schema_production_sampling(
    mssql_engine,
    mssql_session,
    literal_schema_objects,
    monkeypatch,
    service_type,
    schema_name,
    sql_schema,
    table_name,
    table_type,
):
    from uuid import UUID

    from sqlalchemy import func

    from metadata.generated.schema.entity.data.database import Database
    from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
    from metadata.generated.schema.entity.data.table import Column as CatalogColumn
    from metadata.generated.schema.entity.data.table import DataType, Table
    from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import AzureSQLConnection
    from metadata.generated.schema.entity.services.connections.database.mssqlConnection import MssqlConnection
    from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
    from metadata.ingestion.ometa.ometa_api import OpenMetadata
    from metadata.profiler.metrics.registry import Metrics
    from metadata.sampler.models import SampleConfig
    from metadata.sampler.sampler_config import DatabaseSamplerConfig
    from metadata.sampler.sqlalchemy.azuresql.sampler import AzureSQLSampler
    from metadata.sampler.sqlalchemy.mssql.sampler import MssqlSampler

    database = Database(id=UUID(int=1), name="master", service={"id": str(UUID(int=2)), "type": "databaseService"})
    schema = DatabaseSchema(
        id=UUID(int=3),
        name=schema_name,
        service=database.service,
        database={"id": str(database.id.root), "type": "database"},
    )
    entity = Table(
        id=UUID(int=4),
        name=table_name,
        tableType=table_type,
        serviceType=service_type,
        columns=[CatalogColumn(name="id", dataType=DataType.INT), CatalogColumn(name="name", dataType=DataType.STRING)],
        database={"id": str(database.id.root), "type": "database"},
        databaseSchema={"id": str(schema.id.root), "type": "databaseSchema", "name": schema_name},
    )
    metadata = MagicMock(spec=OpenMetadata)
    metadata.get_by_id.side_effect = lambda *, entity, entity_id, nullable: {
        Database: database,
        DatabaseSchema: schema,
    }[entity]
    monkeypatch.setattr("metadata.sampler.sqlalchemy.sampler.get_ssl_connection", lambda _: mssql_engine)
    connection_class, sampler_class = (
        (MssqlConnection, MssqlSampler) if service_type == "Mssql" else (AzureSQLConnection, AzureSQLSampler)
    )
    static = StaticSamplingConfig(profileSample=100, profileSampleType=ProfileSampleType.PERCENTAGE)
    sampler = sampler_class(
        service_connection_config=connection_class(
            username="fixture", password="fixture", hostPort="localhost:1433", database="master"
        ),
        ometa_client=metadata,
        entity=entity,
        config=DatabaseSamplerConfig(
            sample_config=SampleConfig(
                profileSampleConfig=ProfileSampleConfig(sampleConfigType=SampleConfigType.STATIC, config=static)
            )
        ),
    )
    try:
        expected = [(11, "first"), (29, "second")]
        independent = mssql_session.execute(
            text(f"SELECT id, name FROM {sql_schema}.{table_name} ORDER BY id")
        ).fetchall()
        assert [tuple(row) for row in independent] == expected
        assert sorted(tuple(row) for row in sampler.fetch_sample_data().rows) == expected
        query = sampler.get_sample_query(static)
        sql = str(query.compile(dialect=mssql_engine.dialect))
        assert ("TABLESAMPLE" in sql) == (table_type == TableType.Regular)
        assert f"FROM {sql_schema}.{table_name}" in sql
        assert sorted(tuple(row) for row in mssql_session.query(query).all()) == expected

        runner = QueryRunner(session=mssql_session, dataset=sampler.raw_dataset, raw_dataset=sampler.raw_dataset)
        assert runner.schema_name == schema_name
        assert runner.select_first_from_table(func.sum(sampler.raw_dataset.id))[0] == 40
        if table_type == TableType.Regular:
            computer = MSSQLTableMetricComputer(
                runner=runner, metrics=[Metrics.rowCount], conn_config=sampler.service_connection_config, entity=entity
            )
            computer._set_table_and_schema_name()
            result = computer.compute()
            assert result is not None
            assert result.rowCount == 2
    finally:
        sampler.session_factory.remove()
