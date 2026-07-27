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
