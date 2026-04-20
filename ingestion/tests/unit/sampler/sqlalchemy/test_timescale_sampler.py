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
Test TimescaleDB sampler compression detection logic.

Validates that ``_has_compressed_chunks`` correctly distinguishes between:
- regular (non-hypertable) tables
- hypertables with no compression
- hypertables with mixed compressed/uncompressed chunks
- hypertables where all chunks are compressed
- database errors during detection
"""
from collections import namedtuple
from contextlib import contextmanager
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import DeclarativeBase

from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection as PostgresConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.timescaleConnection import (
    TimescaleConnection as TimescaleConnectionConfig,
)
from metadata.profiler.orm.functions.table_metric_computer import TableMetricComputer
from metadata.profiler.orm.registry import Dialects
from metadata.sampler.sqlalchemy.timescale.sampler import TimescaleSampler

TimeDimensionRow = namedtuple("TimeDimensionRow", ["column_name"])
CompressionInfoRow = namedtuple(
    "CompressionInfoRow", ["has_compressed", "uncompressed_boundary"]
)


class Base(DeclarativeBase):
    pass


class SensorReadings(Base):
    __tablename__ = "sensor_readings"
    __table_args__ = {"schema": "public"}
    id = Column(Integer, primary_key=True)
    time = Column(DateTime(timezone=True))
    device_id = Column(String(256))
    value = Column(Integer)


def _make_sampler(query_results):
    """Create a TimescaleSampler that will execute against mocked DB results.

    ``query_results`` is a list of rows returned by successive
    ``session.execute().first()`` calls.  The sampler issues two queries:
      1. TIMESCALE_GET_TIME_DIMENSION  → returns a row with the time column name
      2. TIMESCALE_GET_COMPRESSION_INFO → returns has_compressed + boundary
    Pass ``None`` as the first element to simulate a non-hypertable.
    """
    sampler = TimescaleSampler.__new__(TimescaleSampler)
    sampler._table = SensorReadings
    sampler._hypertable_meta = None
    sampler._hypertable_checked = False

    call_index = 0

    class FakeResult:
        def __init__(self, row):
            self._row = row

        def first(self):
            return self._row

    class FakeSession:
        def execute(self, statement, params=None):
            nonlocal call_index
            row = query_results[call_index]
            call_index += 1
            return FakeResult(row)

    @contextmanager
    def fake_session_factory():
        yield FakeSession()

    sampler.session_factory = fake_session_factory
    return sampler


def _make_failing_sampler(error):
    """Create a TimescaleSampler whose DB session raises on execute."""
    sampler = TimescaleSampler.__new__(TimescaleSampler)
    sampler._table = SensorReadings
    sampler._hypertable_meta = None
    sampler._hypertable_checked = False

    class FailingSession:
        def execute(self, statement, params=None):
            raise error

    @contextmanager
    def fake_session_factory():
        yield FailingSession()

    sampler.session_factory = fake_session_factory
    return sampler


class TestHasCompressedChunks:
    def test_regular_table(self):
        """A non-hypertable returns no time dimension row → no compressed chunks."""
        sampler = _make_sampler(query_results=[None])

        assert sampler._has_compressed_chunks() is False
        assert sampler._hypertable_meta is None

    def test_hypertable_no_compression(self):
        """All chunks uncompressed → has_compressed is False."""
        sampler = _make_sampler(
            query_results=[
                TimeDimensionRow(column_name="time"),
                CompressionInfoRow(
                    has_compressed=False,
                    uncompressed_boundary=datetime(2024, 1, 1, tzinfo=timezone.utc),
                ),
            ]
        )

        assert sampler._has_compressed_chunks() is False

    def test_hypertable_mixed_chunks(self):
        """Some compressed, some uncompressed → has_compressed is True with boundary."""
        boundary = datetime(2025, 9, 17, 20, 0, tzinfo=timezone.utc)
        sampler = _make_sampler(
            query_results=[
                TimeDimensionRow(column_name="time"),
                CompressionInfoRow(
                    has_compressed=True,
                    uncompressed_boundary=boundary,
                ),
            ]
        )

        assert sampler._has_compressed_chunks() is True
        assert sampler._hypertable_meta.uncompressed_boundary == boundary

    def test_hypertable_all_compressed(self):
        """All chunks compressed → has_compressed is True, boundary is None."""
        sampler = _make_sampler(
            query_results=[
                TimeDimensionRow(column_name="time"),
                CompressionInfoRow(
                    has_compressed=True,
                    uncompressed_boundary=None,
                ),
            ]
        )

        assert sampler._has_compressed_chunks() is True
        assert sampler._hypertable_meta.uncompressed_boundary is None

    def test_db_error_falls_back(self):
        """Database error during detection → treat as no compressed chunks."""
        sampler = _make_failing_sampler(Exception("connection refused"))

        assert sampler._has_compressed_chunks() is False
        assert sampler._hypertable_meta is None
        assert sampler._hypertable_checked is True

    def test_result_is_cached(self):
        """Repeated calls do not re-query the database."""
        boundary = datetime(2025, 9, 17, 20, 0, tzinfo=timezone.utc)
        sampler = _make_sampler(
            query_results=[
                TimeDimensionRow(column_name="time"),
                CompressionInfoRow(has_compressed=True, uncompressed_boundary=boundary),
            ]
        )

        result1 = sampler._has_compressed_chunks()
        result2 = sampler._has_compressed_chunks()

        assert result1 is True
        assert result2 is True
        # If it queried twice, the second call would fail with IndexError
        # since query_results only has 2 entries for 2 queries (one invocation).


class TestResolveDialect:
    def test_timescale_connection_resolves_to_timescale(self):
        ts_config = TimescaleConnectionConfig(
            hostPort="localhost:5432", username="test", database="testdb"
        )
        assert (
            TableMetricComputer._resolve_dialect(Dialects.Postgres, ts_config)
            == "timescale"
        )

    def test_postgres_connection_stays_postgres(self):
        pg_config = PostgresConnectionConfig(
            hostPort="localhost:5432", username="test", database="testdb"
        )
        assert (
            TableMetricComputer._resolve_dialect(Dialects.Postgres, pg_config)
            == Dialects.Postgres
        )

    def test_non_postgres_dialect_unchanged(self):
        ts_config = TimescaleConnectionConfig(
            hostPort="localhost:5432", username="test", database="testdb"
        )
        assert (
            TableMetricComputer._resolve_dialect(Dialects.MySQL, ts_config)
            == Dialects.MySQL
        )

    def test_none_conn_config(self):
        assert (
            TableMetricComputer._resolve_dialect(Dialects.Postgres, None)
            == Dialects.Postgres
        )
