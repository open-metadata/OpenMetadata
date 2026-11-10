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
compute_metrics_in_thread must still run a full garbage collection after every
metric. The metric-heavy modules skip it (see the profiler conftest), so this
module keeps the real gc module in place and checks the cleanup on each path.
"""

import gc
from pathlib import Path
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import Column, Integer, String
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import DeclarativeBase

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.profiler.api.models import ThreadPoolMetrics
from metadata.profiler.interface.sqlalchemy import profiler_interface
from metadata.profiler.interface.sqlalchemy.profiler_interface import SQAProfilerInterface
from metadata.profiler.metrics.core import MetricTypes
from metadata.profiler.metrics.static.row_count import RowCount
from metadata.sampler.sqlalchemy.sampler import SQASampler

from ..conftest import GC_STUBBED_MODULES  # noqa: TID252


class _Base(DeclarativeBase):
    pass


class User(_Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))


@pytest.fixture
def interface():
    sqlite_conn = SQLiteConnection(scheme=SQLiteScheme.sqlite_pysqlite)
    table_entity = Table(
        id=uuid4(),
        name="user",
        columns=[EntityColumn(name=ColumnName("id"), dataType=DataType.INT)],
    )
    with patch.object(SQASampler, "build_table_orm", return_value=User):
        sampler = SQASampler(service_connection_config=sqlite_conn, ometa_client=None, entity=None)
        sqa_interface = SQAProfilerInterface(sqlite_conn, None, table_entity, None, sampler, 5, 43200)
    yield sqa_interface
    sqa_interface.close()


@pytest.fixture
def collect_spy():
    """Count full collections while still running the real gc.collect."""
    with patch.object(gc, "collect", wraps=gc.collect) as spy:
        yield spy


def _table_metric():
    return ThreadPoolMetrics(metrics=[RowCount], metric_type=MetricTypes.Table, column=None, table=User)


def _use_metric_fn(interface, metric_fn):
    interface._get_metric_fn = {MetricTypes.Table.value: metric_fn}


def test_profiler_interface_uses_the_real_gc_module():
    """Fails if the conftest stub leaks into this module."""
    assert profiler_interface.gc is gc


def test_gc_stub_targets_existing_modules_only():
    """A renamed module would silently fall back to the slow path."""
    profiler_tests = Path(__file__).parents[1]
    assert GC_STUBBED_MODULES
    assert all((profiler_tests / module).is_file() for module in GC_STUBBED_MODULES)


def test_full_collection_after_successful_metric(interface, collect_spy):
    _use_metric_fn(interface, Mock(return_value={"rowCount": 2}))

    result = interface.compute_metrics_in_thread(_table_metric())

    assert result == ({"rowCount": 2}, None, MetricTypes.Table.value)
    collect_spy.assert_called_once_with()


def test_full_collection_after_failed_metric(interface, collect_spy):
    _use_metric_fn(interface, Mock(side_effect=Exception("metric failed")))

    with patch.object(interface.session.get_bind().dialect, "is_disconnect", return_value=False):
        result = interface.compute_metrics_in_thread(_table_metric())

    assert result == (None, None, None)
    assert interface.status.failures
    collect_spy.assert_called_once_with()


def test_full_collection_after_each_retried_attempt(interface, collect_spy):
    metric_fn = Mock(side_effect=[DBAPIError("disconnected", None, None), {"rowCount": 2}])
    _use_metric_fn(interface, metric_fn)

    with (
        patch.object(interface.session.get_bind().dialect, "is_disconnect", return_value=True),
        patch.object(profiler_interface.time, "sleep"),
    ):
        result = interface.compute_metrics_in_thread(_table_metric())

    assert result == ({"rowCount": 2}, None, MetricTypes.Table.value)
    assert metric_fn.call_count == 2
    assert collect_spy.call_count == 2
    assert all(call.args == () and call.kwargs == {} for call in collect_spy.call_args_list)
