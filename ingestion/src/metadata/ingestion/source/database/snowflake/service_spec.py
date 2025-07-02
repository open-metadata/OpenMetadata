from metadata.data_quality.interface.sqlalchemy.snowflake.test_suite_interface import (
    SnowflakeTestSuiteInterface,
)
from metadata.ingestion.source.database.snowflake.data_diff.data_diff import (
    SnowflakeTableParameter,
)
from metadata.ingestion.source.database.snowflake.lineage import SnowflakeLineageSource
from metadata.ingestion.source.database.snowflake.metadata import SnowflakeSource
from metadata.ingestion.source.database.snowflake.usage import SnowflakeUsageSource
from metadata.profiler.interface.sqlalchemy.snowflake.profiler_interface import (
    SnowflakeProfilerInterface,
)
from metadata.sampler.sqlalchemy.snowflake.sampler import SnowflakeSampler
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=SnowflakeSource,
    lineage_source_class=SnowflakeLineageSource,
    usage_source_class=SnowflakeUsageSource,
    profiler_class=SnowflakeProfilerInterface,
    test_suite_class=SnowflakeTestSuiteInterface,
    sampler_class=SnowflakeSampler,
    data_diff=SnowflakeTableParameter,
)
