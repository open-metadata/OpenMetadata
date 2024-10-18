from metadata.ingestion.source.database.redshift.profiler.system import (
    RedshiftSystemMetricsSource,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)


class RedshiftProfiler(SQAProfilerInterface):
    system_metrics_source_class = RedshiftSystemMetricsSource
