"""Redshift profiler"""

from metadata.ingestion.source.database.redshift.profiler.system import (
    RedshiftSystemMetricsComputer,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.metrics.system.system import SystemMetricsComputer


class RedshiftProfiler(SQAProfilerInterface):
    def initialize_system_metrics_computer(self) -> SystemMetricsComputer:
        return RedshiftSystemMetricsComputer(session=self.session)
