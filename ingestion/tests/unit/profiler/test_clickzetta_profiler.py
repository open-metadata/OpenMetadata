"""Offline ClickZetta profiler capability and SQL compilation tests."""

from types import SimpleNamespace

import pytest
from sqlalchemy import Column, Integer, MetaData, String, Table, select

from metadata.profiler.metrics.static.count import Count
from metadata.profiler.metrics.static.distinct_count import DistinctCount
from metadata.profiler.metrics.static.max import Max
from metadata.profiler.metrics.static.mean import Mean
from metadata.profiler.metrics.static.min import Min
from metadata.profiler.metrics.static.null_count import NullCount
from metadata.profiler.metrics.static.row_count import RowCount
from metadata.profiler.metrics.static.stddev import StdDev
from metadata.profiler.metrics.static.sum import Sum
from metadata.profiler.orm.functions.table_metric_computer import (
    BaseTableMetricComputer,
    table_metric_computer_factory,
)


def _clickzetta_dialect():
    pytest.importorskip("sqlalchemy_clickzetta")
    from sqlalchemy.engine import make_url

    return make_url("clickzetta://").get_dialect()()


def test_clickzetta_core_metric_sql_compiles_without_a_live_connection():
    table = Table("orders", MetaData(), Column("id", Integer), Column("name", String), schema="seller_center")
    dialect = _clickzetta_dialect()

    expressions = [
        Count(table.c.id).fn(),
        NullCount(table.c.name).fn(),
        DistinctCount(table.c.id).fn(),
        Mean(table.c.id).fn(),
        Min(table.c.id).fn(),
        Max(table.c.id).fn(),
        Sum(table.c.id).fn(),
        StdDev(table.c.id).fn(),
    ]
    sql = str(select(*expressions).select_from(table).compile(dialect=dialect))

    assert dialect.name == "clickzetta"
    assert "seller_center" in sql
    assert "COUNT" in sql.upper()
    assert "STDDEV_POP" in sql.upper()


def test_clickzetta_uses_standard_table_metric_computer_without_a_private_full_scan_gate():
    runner = _fake_runner()
    runner.select_result = SimpleNamespace(rowCount=3, _asdict=lambda: {"rowCount": 3})
    computer = table_metric_computer_factory.construct(
        "clickzetta",
        runner=runner,
        metrics=[RowCount],
        conn_config=SimpleNamespace(connectionOptions=None),
        entity=None,
    )

    result = computer.compute()

    assert isinstance(computer, BaseTableMetricComputer)
    assert result.rowCount == 3
    assert runner.select_calls == 1


def _fake_runner():
    table = Table("orders", MetaData(), Column("id", Integer), Column("name", String), schema="seller_center")
    session = SimpleNamespace(get_bind=lambda: SimpleNamespace(url=SimpleNamespace(database="quick_start")))
    runner = SimpleNamespace(
        _session=session,
        dataset=table,
        raw_dataset=table,
        schema_name="seller_center",
        table_name="orders",
        select_calls=0,
        select_result=SimpleNamespace(_asdict=dict),
    )

    def select_first_from_table(*_args):
        runner.select_calls += 1
        return runner.select_result

    runner.select_first_from_table = select_first_from_table
    return runner
