"""
Test MariaDB profiler interface overrides.
"""

from unittest.mock import Mock

import pytest
from sqlalchemy import Column, Integer, MetaData, Table

from metadata.profiler.interface.sqlalchemy.mariadb.profiler_interface import MariaDBProfilerInterface
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.source.database.mariadb.functions.median import MariaDBMedianFn


class TestMariaDBProfilerInterface:
    """Test MariaDB-specific profiler interface behavior."""

    @pytest.fixture
    def profiler_interface(self):
        return MariaDBProfilerInterface.__new__(MariaDBProfilerInterface)

    @pytest.fixture
    def column(self):
        return Table("users", MetaData(), Column("age", Integer)).c.age

    @pytest.fixture
    def runner(self):
        runner = Mock(table_name="users")
        runner.select_first_from_sample.return_value = None
        return runner

    def _computed_labels(self, runner):
        args = runner.select_first_from_sample.call_args.args
        assert all(isinstance(arg.element, MariaDBMedianFn) for arg in args)
        return [arg.name for arg in args]

    def test_compute_window_metrics_only_computes_requested_metrics(self, profiler_interface, runner, column):
        profiler_interface._compute_window_metrics([Metrics.median.value], runner, session=Mock(), column=column)

        assert self._computed_labels(runner) == [Metrics.median.value.name()]

    def test_compute_window_metrics_uses_mariadb_functions_for_all_quartiles(self, profiler_interface, runner, column):
        metrics = [Metrics.firstQuartile.value, Metrics.median.value, Metrics.thirdQuartile.value]

        profiler_interface._compute_window_metrics(metrics, runner, session=Mock(), column=column)

        assert self._computed_labels(runner) == [metric.name() for metric in metrics]

    def test_compute_window_metrics_skips_empty_metrics(self, profiler_interface, runner, column):
        assert profiler_interface._compute_window_metrics([], runner, session=Mock(), column=column) is None
        runner.select_first_from_sample.assert_not_called()
