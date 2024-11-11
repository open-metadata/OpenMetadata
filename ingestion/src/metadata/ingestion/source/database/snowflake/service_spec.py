from metadata.ingestion.source.database.snowflake.lineage import SnowflakeLineageSource
from metadata.ingestion.source.database.snowflake.metadata import SnowflakeSource
from metadata.ingestion.source.database.snowflake.profiler.profiler import (
    SnowflakeProfiler,
)
from metadata.ingestion.source.database.snowflake.usage import SnowflakeUsageSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=SnowflakeSource,
    lineage_source_class=SnowflakeLineageSource,
    usage_source_class=SnowflakeUsageSource,
    profiler_class=SnowflakeProfiler,
)
