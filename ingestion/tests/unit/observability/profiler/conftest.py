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
Conftest for profiler tests
"""

import types
from pathlib import Path
from uuid import UUID

from pytest import fixture
from sqlalchemy import create_engine

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.connections.session import create_and_bind_session

# compute_metrics_in_thread runs a full gc.collect() after every metric. In a
# worker that has imported the whole unit suite each call takes seconds, and
# test_metrics.py computes almost 500 metrics, so the collections alone kept one
# CI worker busy for about 25 minutes. Only the modules listed here skip it;
# sqlalchemy/test_profiler_interface_gc.py checks the real collection.
GC_STUBBED_MODULES = frozenset(
    {
        "sqlalchemy/test_metrics.py",
    }
)


@fixture(autouse=True)
def skip_forced_gc_in_metric_heavy_modules(request, monkeypatch):
    module = request.path.relative_to(Path(__file__).parent).as_posix()
    if module in GC_STUBBED_MODULES:
        monkeypatch.setattr(
            "metadata.profiler.interface.sqlalchemy.profiler_interface.gc",
            types.SimpleNamespace(collect=lambda *_args, **_kwargs: 0),
        )


def metadata_connection_object():
    return OpenMetadataConnection(hostPort="http://localhost:8585/api")


def session():
    engine = create_engine("sqlite+pysqlite:///:memory:", echo=True, future=True)
    session = create_and_bind_session(engine)

    yield session

    session.close()


@fixture
def base_table():
    return Table(
        id=UUID("12345678123456781234567812345678"),
        name="table",
        fullyQualifiedName="my.awesome.table",
        columns=[
            Column(
                name="foo",
                dataType=DataType.STRING,
            ),
            Column(
                name="bar",
                dataType=DataType.NUMERIC,
            ),
        ],
    )


class Row:
    def __init__(
        self,
        query_id,
        query_type,
        start_time,
        query_text,
    ):
        self.QUERY_ID = query_id
        self.QUERY_TYPE = query_type
        self.START_TIME = start_time
        self.QUERY_TEXT = query_text

    def __iter__(self):
        """implementation to support dict(row)"""
        yield "QUERY_ID", self.QUERY_ID
        yield "QUERY_TYPE", self.QUERY_TYPE
        yield "START_TIME", self.START_TIME
        yield "QUERY_TEXT", self.QUERY_TEXT


class LowerRow:
    def __init__(
        self,
        query_id,
        query_type,
        start_time,
        query_text,
    ):
        self.QUERY_ID = query_id
        self.QUERY_TYPE = query_type
        self.START_TIME = start_time
        self.QUERY_TEXT = query_text

    def __iter__(self):
        """implementation to support dict(row)"""
        yield "query_id", self.QUERY_ID
        yield "query_type", self.QUERY_TYPE
        yield "start_time", self.START_TIME
        yield "query_text", self.QUERY_TEXT
