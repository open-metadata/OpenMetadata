from metadata.ingestion.source.database.athena.lineage import AthenaLineageSource
from metadata.ingestion.source.database.athena.metadata import AthenaSource
from metadata.ingestion.source.database.athena.usage import AthenaUsageSource
from metadata.profiler.interface.sqlalchemy.athena.profiler_interface import (
    AthenaProfilerInterface,
)
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=AthenaSource,
    lineage_source_class=AthenaLineageSource,
    usage_source_class=AthenaUsageSource,
    profiler_class=AthenaProfilerInterface,
)
