from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.snowflake.metadata.SnowflakeSource",
    lineage_source_class="metadata.ingestion.source.database.snowflake.lineage.SnowflakeLineageSource",
    usage_source_class="metadata.ingestion.source.database.snowflake.usage.SnowflakeUsageSource",
    profiler_class="metadata.profiler.interface.sqlalchemy.snowflake.profiler_interface.SnowflakeProfilerInterface",
    test_suite_class="metadata.data_quality.interface.sqlalchemy.snowflake.test_suite_interface.SnowflakeTestSuiteInterface",
    sampler_class="metadata.sampler.sqlalchemy.snowflake.sampler.SnowflakeSampler",
    data_diff="metadata.ingestion.source.database.snowflake.data_diff.data_diff.SnowflakeTableParameter",
    connection_class="metadata.ingestion.source.database.snowflake.connection.SnowflakeConnection",
)
