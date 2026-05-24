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
Integration tests for TimescaleTableMetricComputer against a real TimescaleDB instance.
Tests both hypertable (TimescaleDB-specific) and regular table paths.
"""

from unittest.mock import Mock, patch

import pytest
from sqlalchemy import Column, Integer, String, create_engine, text
from sqlalchemy.orm import DeclarativeBase
from testcontainers.postgres import PostgresContainer

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.profiler.orm.functions.table_metric_computer import (
    BaseTableMetricComputer,
    PostgresTableMetricComputer,
    TimescaleTableMetricComputer,
)
from metadata.profiler.processor.runner import QueryRunner


class Base(DeclarativeBase):
    pass


class RegularTable(Base):
    __tablename__ = "regular_test"
    __table_args__ = {"schema": "public"}  # noqa: RUF012
    id = Column(Integer, primary_key=True)
    name = Column(String(256))


class HyperTable(Base):
    __tablename__ = "hyper_test"
    __table_args__ = {"schema": "public"}  # noqa: RUF012
    id = Column(Integer, primary_key=True)
    name = Column(String(256))


class NonExistentModel(Base):
    __tablename__ = "nonexistent_table_xyz"
    __table_args__ = {"schema": "public"}  # noqa: RUF012
    id = Column(Integer, primary_key=True)


@pytest.fixture(scope="module")
def ts_engine():
    container = PostgresContainer("timescale/timescaledb-ha:pg15")
    with container as container:
        engine = create_engine(container.get_connection_url())
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb"))
            conn.execute(text("CREATE TABLE public.regular_test (id INTEGER PRIMARY KEY, name VARCHAR(256))"))
            conn.execute(
                text(
                    "INSERT INTO public.regular_test (id, name) "
                    "SELECT g, 'name_' || g FROM generate_series(1, 100) AS g"
                )
            )
            conn.execute(text("ANALYZE public.regular_test"))
            conn.execute(
                text(
                    "CREATE TABLE public.hyper_test "
                    "(id INTEGER NOT NULL, name VARCHAR(256), ts TIMESTAMPTZ NOT NULL DEFAULT now())"
                )
            )
            conn.execute(text("SELECT create_hypertable('public.hyper_test', 'ts')"))
            conn.execute(
                text(
                    "INSERT INTO public.hyper_test (id, name, ts) "
                    "SELECT g, 'name_' || g, now() - (g || ' hours')::interval "
                    "FROM generate_series(1, 50) AS g"
                )
            )
            conn.execute(text("ANALYZE public.hyper_test"))
            conn.commit()
        yield engine
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS public.regular_test"))
            conn.execute(text("DROP TABLE IF EXISTS public.hyper_test"))
            conn.commit()
        engine.dispose()


@pytest.fixture(scope="module")
def session(ts_engine):
    session = create_and_bind_session(ts_engine)
    yield session
    session.close()


def _build_computer(session, model, table_type=TableType.Regular):
    runner = QueryRunner(
        session=session,
        dataset=model,
        raw_dataset=model,
    )
    entity = Mock()
    entity.tableType = table_type
    computer = TimescaleTableMetricComputer(
        runner=runner,
        metrics=[],
        conn_config=None,
        entity=entity,
    )
    computer._set_table_and_schema_name()
    return computer


class TestTimescaleTableMetricComputer:
    def test_regular_table_uses_pg_catalog(self, session):
        """Non-hypertable should fall back to PostgreSQL pg_class logic."""
        computer = _build_computer(session, RegularTable)
        result = computer.compute()
        assert result is not None
        assert result.rowCount == 100
        assert result.sizeInBytes > 0

    def test_hypertable_uses_approximate_row_count(self, session):
        """Hypertable should use TimescaleDB approximate_row_count(), not pg_class."""
        computer = _build_computer(session, HyperTable)
        with (
            patch.object(
                PostgresTableMetricComputer,
                "compute",
                wraps=PostgresTableMetricComputer.compute,
            ) as pg_fallback,
            patch.object(
                BaseTableMetricComputer,
                "compute",
                wraps=BaseTableMetricComputer.compute,
            ) as base_fallback,
        ):
            result = computer.compute()
        assert result is not None
        assert result.rowCount == 50
        assert result.sizeInBytes is not None
        pg_fallback.assert_not_called()
        base_fallback.assert_not_called()

    def test_hypertable_returns_column_metadata(self, session):
        computer = _build_computer(session, HyperTable)
        with (
            patch.object(
                PostgresTableMetricComputer,
                "compute",
                wraps=PostgresTableMetricComputer.compute,
            ) as pg_fallback,
            patch.object(
                BaseTableMetricComputer,
                "compute",
                wraps=BaseTableMetricComputer.compute,
            ) as base_fallback,
        ):
            result = computer.compute()
        assert result is not None
        assert result.columnCount == 2
        assert "id" in result.columnNames
        assert "name" in result.columnNames
        pg_fallback.assert_not_called()
        base_fallback.assert_not_called()

    def test_nonexistent_table_returns_none(self, session):
        computer = _build_computer(session, NonExistentModel)
        result = computer.compute()
        assert result is None
