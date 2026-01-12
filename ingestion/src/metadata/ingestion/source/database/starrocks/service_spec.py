from metadata.ingestion.source.database.starrocks.lineage import StarRocksLineageSource
from metadata.ingestion.source.database.starrocks.metadata import StarRocksSource
from metadata.ingestion.source.database.starrocks.usage import StarRocksUsageSource
from metadata.profiler.interface.sqlalchemy.starrocks.profiler_interface import (
    StarRocksProfilerInterface,
)
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=StarRocksSource,
    lineage_source_class=StarRocksLineageSource,
    usage_source_class=StarRocksUsageSource,
    profiler_class=StarRocksProfilerInterface,
)
