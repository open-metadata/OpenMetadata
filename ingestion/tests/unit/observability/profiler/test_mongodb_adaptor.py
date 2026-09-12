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

"""Unit tests for the MongoDB NoSQL profiler adaptor.

Exercises ``MongoDB.get_aggregates``, ``Aggregation.to_executable`` and
``NoSQLProfilerInterface._compute_static_metrics`` in isolation by mocking
``pymongo.MongoClient`` (no real MongoDB required).

Coverage focus: a MongoDB ``$group`` with ``_id: null`` over an **empty**
collection emits **zero** documents (unlike a SQL aggregate, which always
returns one row of NULLs). ``get_aggregates`` must therefore return an empty
dict instead of indexing ``[0]`` and raising ``IndexError``; the caller
``_compute_static_metrics`` must then return ``{}`` cleanly (so the column is
skipped in ``get_all_metrics``) rather than re-raising ``RuntimeError`` and
producing a ``failed_profiler`` entry per quantifiable column.
"""

from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

from pytest import fixture

from metadata.generated.schema.entity.data.table import (
    Column as EntityColumn,
)
from metadata.generated.schema.entity.data.table import (
    ColumnName,
    DataType,
    Table,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.adaptors.mongodb import (
    Aggregation,
    AggregationFunction,
    MongoDB,
)
from metadata.profiler.api.models import ThreadPoolMetrics
from metadata.profiler.interface.nosql.profiler_interface import (
    NoSQLProfilerInterface,
)
from metadata.profiler.metrics.core import MetricTypes
from metadata.profiler.metrics.static.max import Max
from metadata.profiler.metrics.static.mean import Mean
from metadata.profiler.metrics.static.min import Min
from metadata.profiler.metrics.static.sum import Sum
from metadata.utils.sqa_like_column import SQALikeColumn

DB = "test_db"
COLL = "test_collection"
COLUMN = "age"
AGGREGATIONS = [
    AggregationFunction.SUM,
    AggregationFunction.MEAN,
    AggregationFunction.MAX,
    AggregationFunction.MIN,
]


def _table() -> Table:
    """Minimal ``Table`` entity matching what ``get_aggregates`` reads
    (``table.databaseSchema.name`` and ``table.name.root``)."""
    return Table(
        id=uuid4(),
        name=COLL,
        fullyQualifiedName=f"{DB}.{COLL}",
        columns=[EntityColumn(name=ColumnName(COLUMN), dataType=DataType.INT)],
        databaseSchema=EntityReference(id=uuid4(), name=DB, type="databaseSchema"),
    )


def _column() -> SQALikeColumn:
    return SQALikeColumn(name=COLUMN, type=DataType.INT)


def _mock_aggregate_rows(rows: list) -> MongoDB:
    """Build a real ``MongoDB`` adaptor whose pymongo client's
    ``[DB][COLL].aggregate(...)`` returns ``rows`` (modelling the materialized
    ``$group`` cursor for both the empty and non-empty cases)."""
    client = MagicMock()
    # MagicMock caches child mocks, so ``[DB][COLL]`` is stable across accesses.
    client[DB][COLL].aggregate.return_value = rows
    return MongoDB(client)


# --- Aggregation.to_executable -------------------------------------------------


def test_aggregation_to_executable_builds_group_pipeline_with_column_and_accumulators():
    """``to_executable`` produces a single ``$group`` stage with ``_id: null``
    and one accumulator per aggregation, named after the aggregation and reading
    the configured column. ``_id: null`` is what causes an empty collection to
    emit zero documents — so asserting the shape pins the empty-result semantics
    the fix relies on."""
    client = MagicMock()
    agg = Aggregation(
        database=DB,
        collection=COLL,
        column=COLUMN,
        aggregations=AGGREGATIONS,
    )

    agg.to_executable(client)

    collection = client[DB][COLL]
    collection.aggregate.assert_called_once()
    pipeline = collection.aggregate.call_args.args[0]
    assert pipeline == [
        {
            "$group": {
                "_id": None,
                "sum": {"$sum": f"${COLUMN}"},
                "mean": {"$avg": f"${COLUMN}"},
                "max": {"$max": f"${COLUMN}"},
                "min": {"$min": f"${COLUMN}"},
            },
        },
    ]


# --- MongoDB.get_aggregates (the bug) -----------------------------------------


def test_get_aggregates_returns_aggregates_without_id_for_non_empty_collection():
    """Regression: on a non-empty collection the single ``$group`` row is returned
    as a dict of aggregates with ``_id`` stripped out and numeric values preserved."""
    adaptor = _mock_aggregate_rows([{"_id": None, "sum": 6, "mean": 2.0, "max": 3, "min": 1}])

    result = adaptor.get_aggregates(_table(), _column(), AGGREGATIONS)

    assert result == {"sum": 6, "mean": 2.0, "max": 3, "min": 1}
    assert "_id" not in result


def test_get_aggregates_returns_empty_dict_for_empty_collection():
    """Bug fix: a ``$group`` over an empty MongoDB collection returns **zero**
    documents. ``get_aggregates`` must return ``{}`` instead of raising
    ``IndexError: list index out of range`` (previously from ``self.execute(...)[0]``)."""
    adaptor = _mock_aggregate_rows([])  # empty collection -> no $group output

    result = adaptor.get_aggregates(_table(), _column(), AGGREGATIONS)

    assert result == {}


# --- NoSQLProfilerInterface._compute_static_metrics (the contract) ------------


@fixture
def nosql_profiler_interface():
    """A ``NoSQLProfilerInterface`` wired with mocked connection/sampler so it can
    be driven purely through its ``_compute_static_metrics`` method with a real
    ``MongoDB`` runner (constructed per test with a mocked pymongo client)."""
    with patch(
        "metadata.profiler.interface.profiler_interface.get_ssl_connection",
        return_value=Mock(),
    ):
        interface = NoSQLProfilerInterface(
            Mock(),  # service_connection_config (unused by _compute_static_metrics)
            None,  # ometa_client
            _table(),  # entity / table
            None,  # source_config
            Mock(),  # sampler
            5,  # thread_count
            43200,  # timeout_seconds
        )
        yield interface


def test_compute_static_metrics_returns_empty_dict_on_empty_collection(nosql_profiler_interface):
    """Contract: when the underlying collection is empty, ``get_aggregates``
    returns ``{}`` and ``_compute_static_metrics`` returns ``{}`` (falsy -> the
    column is cleanly skipped in ``get_all_metrics``) instead of re-raising
    ``RuntimeError`` and producing a ``failed_profiler`` entry per quantifiable
    column. Exercises the real ``Sum/Max/Mean/Min.nosql_fn -> MongoDB.sum/mean/max/min``
    -> ``MongoDB.get_aggregates`` path."""
    runner = _mock_aggregate_rows([])  # empty collection

    result = nosql_profiler_interface._compute_static_metrics(
        [Sum, Mean, Max, Min],
        runner,
        _column(),
    )

    assert result == {}


def test_compute_static_metrics_returns_aggregates_on_non_empty_collection(nosql_profiler_interface):
    """Regression: ``_compute_static_metrics`` returns the aggregated dict for a
    non-empty collection, exercising the whole metric -> adaptor -> aggregation path."""
    runner = _mock_aggregate_rows([{"_id": None, "sum": 6, "mean": 2.0, "max": 3, "min": 1}])

    result = nosql_profiler_interface._compute_static_metrics(
        [Sum, Mean, Max, Min],
        runner,
        _column(),
    )

    assert result == {"sum": 6, "mean": 2.0, "max": 3, "min": 1}


def test_compute_metrics_logs_no_failed_profiler_for_empty_collection(nosql_profiler_interface):
    """End-to-end-style guard for the bug's stated impact: ``compute_metrics``
    wraps ``_get_metric_fn[Static]`` (= ``_compute_static_metrics``) in a try/except
    that calls ``self.status.failed_profiler(...)`` on any exception. Previously the
    ``IndexError`` from ``get_aggregates`` was re-wrapped as ``RuntimeError`` here,
    producing one ``failed_profiler`` entry (with traceback) per quantifiable column on
    an empty-but-registered collection — which can drag the profiler workflow's
    success rate below the threshold and raise ``WorkflowExecutionError``.

    With the fix, an empty collection flows through as ``row = {}`` (falsy -> the
    column is cleanly skipped in ``get_all_metrics``), the except branch is never
    entered, and ``status.failures`` stays empty. The ``scanned`` record for the
    column/metric is still emitted, so the column counts as processed."""
    runner = _mock_aggregate_rows([])  # empty MongoDB collection
    col = _column()
    metric_func = ThreadPoolMetrics(
        metrics=[Sum, Mean, Max, Min],
        metric_type=MetricTypes.Static,
        column=col,
        table=_table(),
    )

    row, column_name, metric_type = nosql_profiler_interface.compute_metrics(runner, metric_func)

    # No failure recorded for an empty collection: the noisy path is gone.
    assert nosql_profiler_interface.status.failures == []
    # The column was still scanned (so it counts toward the success denominator).
    assert nosql_profiler_interface.status.records == [f"{COLL}.{COLUMN}__Static"]
    # Empty dict -> falsy -> column skipped in get_all_metrics -> columnProfile == [].
    assert row == {}
    assert column_name == COLUMN
    assert metric_type == MetricTypes.Static.value


def test_compute_metrics_logs_failed_profiler_when_runner_raises(nosql_profiler_interface):
    """Regression guard ensuring the ``failed_profiler`` path still fires when a
    genuine error occurs (so the fix only silences the empty-collection case, not
    real failures). A broken runner whose ``get_aggregates`` raises is recorded as a
    failure with traceback."""
    runner = _mock_aggregate_rows([{"_id": None, "sum": 6, "mean": 2.0, "max": 3, "min": 1}])
    runner.get_aggregates = Mock(side_effect=RuntimeError("genuine failure"))
    metric_func = ThreadPoolMetrics(
        metrics=[Sum],
        metric_type=MetricTypes.Static,
        column=_column(),
        table=_table(),
    )

    nosql_profiler_interface.compute_metrics(runner, metric_func)

    assert len(nosql_profiler_interface.status.failures) == 1
