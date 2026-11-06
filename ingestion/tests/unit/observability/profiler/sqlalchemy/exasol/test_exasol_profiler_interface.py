"""
Test Exasol profiler interface overrides.
"""

from unittest.mock import Mock, call

import pytest

from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.profiler.interface.sqlalchemy.exasol.profiler_interface import ExasolProfilerInterface


class TestExasolProfilerInterface:
    """Test Exasol-specific profiler interface behavior."""

    @pytest.fixture
    def profiler_interface(self):
        interface = ExasolProfilerInterface.__new__(ExasolProfilerInterface)
        interface.session = Mock(name="session")
        interface.system_metrics_class = Mock(name="system_metrics_class")
        interface.table_entity = Table.model_construct(tableType=TableType.Regular)
        return interface

    @pytest.fixture
    def runner(self):
        return Mock(table_name="users")

    @pytest.fixture
    def metrics(self):
        metrics = Mock()
        metrics.name.return_value = "system metrics"
        return metrics

    @pytest.mark.parametrize("table_type", [TableType.View, TableType.MaterializedView])
    def test_compute_system_metrics_skips_views(self, profiler_interface, runner, metrics, table_type):
        profiler_interface.table_entity = Table.model_construct(tableType=table_type)

        result = profiler_interface._compute_system_metrics(metrics, runner)

        assert result == []
        profiler_interface.system_metrics_class.assert_not_called()

    def test_compute_system_metrics_delegates_for_regular_tables(self, profiler_interface, runner, metrics):
        system_metrics_instance = Mock()
        system_metrics_instance.get_system_metrics.return_value = ["profile"]
        profiler_interface.system_metrics_class = Mock(return_value=system_metrics_instance)

        result = profiler_interface._compute_system_metrics(metrics, runner)

        assert result == ["profile"]
        profiler_interface.system_metrics_class.assert_called_once()
        assert profiler_interface.system_metrics_class.call_args == call(
            profiler_interface.session,
            runner,
        )
        system_metrics_instance.get_system_metrics.assert_called_once_with()
