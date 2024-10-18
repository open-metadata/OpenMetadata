from metadata.ingestion.source.database.redshift.profiler.system import (
    RedshiftSystemMetricsComputer,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)


class RedshiftProfiler(SQAProfilerInterface):
    system_metrics_computer_class = RedshiftSystemMetricsComputer
