from metadata.ingestion.source.database.redshift.metadata import RedshiftSource
from metadata.ingestion.source.database.redshift.profiler.profiler import (
    RedshiftProfiler,
)
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=RedshiftSource, profiler_class=RedshiftProfiler
)
