"""BigqQuery Profiler"""

from typing import List, Type

from metadata.generated.schema.entity.data.table import SystemProfile
from metadata.ingestion.source.database.bigquery.profiler.system import (
    BigQuerySystemMetricsComputer,
)
from metadata.profiler.interface.sqlalchemy.bigquery.profiler_interface import (
    BigQueryProfilerInterface,
)
from metadata.profiler.metrics.system.system import System
from metadata.profiler.processor.runner import QueryRunner


class BigQueryProfiler(BigQueryProfilerInterface):
    def _compute_system_metrics(
        self,
        metrics: Type[System],
        runner: QueryRunner,
        *args,
        **kwargs,
    ) -> List[SystemProfile]:
        return self.system_metrics_computer.get_system_metrics(
            table=runner.dataset,
            usage_location=self.service_connection_config.usageLocation,
            runner=runner,
        )

    def initialize_system_metrics_computer(self) -> BigQuerySystemMetricsComputer:
        return BigQuerySystemMetricsComputer(session=self.session)
