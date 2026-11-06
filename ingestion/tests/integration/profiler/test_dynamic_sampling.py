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
Sampler-level integration tests for dynamic sampling against real databases.
Tests _get_asset_row_count accuracy and sampling query execution.
No OpenMetadata server required — only database containers.
"""

from unittest.mock import MagicMock

import pytest
from sqlalchemy import Column, Integer, String, create_engine, text
from sqlalchemy.orm import DeclarativeBase

from _openmetadata_testutils.postgres.conftest import postgres_container  # noqa: F401
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
    PostgresTableMetricComputer,
)
from metadata.profiler.processor.runner import QueryRunner
from metadata.sampler.config import resolve_static_sampling_config


class Base(DeclarativeBase):
    pass


class SamplingTestTable(Base):
    __tablename__ = "sampling_test"
    __table_args__ = {"schema": "public"}  # noqa: RUF012
    id = Column(Integer, primary_key=True)
    name = Column(String(256))


ROW_COUNT = 1000


@pytest.fixture(scope="module")
def pg_engine(postgres_container):  # noqa: F811
    engine = create_engine(postgres_container.get_connection_url())
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS public.sampling_test"))
        conn.execute(text("CREATE TABLE public.sampling_test (id INTEGER PRIMARY KEY, name VARCHAR(256))"))
        conn.execute(
            text(
                "INSERT INTO public.sampling_test (id, name) "
                f"SELECT g, 'row_' || g FROM generate_series(1, {ROW_COUNT}) AS g"
            )
        )
        conn.execute(text("ANALYZE public.sampling_test"))
        conn.commit()
    yield engine
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS public.sampling_test"))
        conn.commit()
    engine.dispose()


@pytest.fixture(scope="module")
def pg_session(pg_engine):
    session = create_and_bind_session(pg_engine)
    yield session
    session.close()


class TestPostgresDynamicSampling:
    """Sampler-level integration tests against a real PostgreSQL database."""

    def test_row_count_via_metric_computer(self, pg_session):
        """Verify PostgresTableMetricComputer returns accurate row count."""
        from metadata.profiler.metrics.registry import Metrics

        runner = QueryRunner(
            session=pg_session,
            dataset=SamplingTestTable,
            raw_dataset=SamplingTestTable,
        )
        entity = MagicMock()
        entity.tableType = TableType.Regular
        entity.name = MagicMock()
        entity.name.root = "sampling_test"
        entity.databaseSchema = MagicMock()
        entity.databaseSchema.name = "public"

        computer = PostgresTableMetricComputer(
            runner=runner,
            metrics=[Metrics.rowCount],
            conn_config=MagicMock(),
            entity=entity,
        )
        computer._set_table_and_schema_name()
        result = computer.compute()
        assert result is not None
        assert result.rowCount == ROW_COUNT

    def test_dynamic_smart_sampling_resolution(self, pg_session):
        """With 1000 rows, smart sampling should resolve to 100% (<=100K tier)."""
        config = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.DYNAMIC,
            config=DynamicSamplingConfig(smartSampling=True),
        )
        static = resolve_static_sampling_config(sample_config=config, row_count=ROW_COUNT)
        assert static is not None
        assert static.profileSample == 100
        assert static.profileSampleType == ProfileSampleType.PERCENTAGE

    def test_dynamic_threshold_resolution(self, pg_session):
        """Custom threshold at 500 rows → 50% should apply for 1000 rows."""
        config = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.DYNAMIC,
            config=DynamicSamplingConfig(
                smartSampling=False,
                thresholds=[
                    Threshold(rowCountThreshold=500, profileSample=50.0),
                ],
            ),
        )
        static = resolve_static_sampling_config(sample_config=config, row_count=ROW_COUNT)
        assert static is not None
        assert static.profileSample == 50.0

    def test_dynamic_threshold_below_row_count_returns_none(self, pg_session):
        """When row count is below all thresholds, resolve returns None (no sampling)."""
        config = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.DYNAMIC,
            config=DynamicSamplingConfig(
                smartSampling=False,
                thresholds=[
                    Threshold(rowCountThreshold=5000, profileSample=10.0),
                ],
            ),
        )
        static = resolve_static_sampling_config(sample_config=config, row_count=ROW_COUNT)
        # 1000 < 5000 threshold → no sampling applied
        assert static is None
