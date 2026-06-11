"""
Interfaces with Exasol database for profiler support.
"""

from typing import Callable, List, Type, cast  # noqa: UP035

from sqlalchemy.orm import Session

from metadata.generated.schema.entity.data.table import SystemProfile, TableType
from metadata.profiler.interface.sqlalchemy.profiler_interface import SQAProfilerInterface
from metadata.profiler.metrics.system.exasol.system import ExasolSystemMetricsComputer
from metadata.profiler.metrics.system.system import System
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


class ExasolProfilerInterface(SQAProfilerInterface):
    """Exasol profiler interface."""

    def _compute_system_metrics(
        self,
        metrics: Type[System],  # noqa: UP006
        runner: QueryRunner,
        *args,
        **kwargs,
    ) -> List[SystemProfile]:  # noqa: UP006
        if self.table_entity.tableType in (TableType.View, TableType.MaterializedView):
            logger.debug(f"Skipping {metrics.name()} metric for view {runner.table_name}")
            return []

        logger.debug(f"Computing {metrics.name()} metric for {runner.table_name}")
        exasol_system_metrics_constructor = cast(
            Callable[[Session, QueryRunner], ExasolSystemMetricsComputer],
            self.system_metrics_class,
        )  # noqa: TC006, UP006
        instance = exasol_system_metrics_constructor(self.session, runner)
        return instance.get_system_metrics()
