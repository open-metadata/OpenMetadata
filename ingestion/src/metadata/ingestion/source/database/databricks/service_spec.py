from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.databricks.metadata.DatabricksSource",
    lineage_source_class="metadata.ingestion.source.database.databricks.lineage.DatabricksLineageSource",
    usage_source_class="metadata.ingestion.source.database.databricks.usage.DatabricksUsageSource",
    profiler_class="metadata.profiler.interface.sqlalchemy.databricks.profiler_interface.DatabricksProfilerInterface",
    test_suite_class="metadata.data_quality.interface.sqlalchemy.databricks.test_suite_interface.DatabricksTestSuiteInterface",
    sampler_class="metadata.sampler.sqlalchemy.databricks.sampler.DatabricksSamplerInterface",
    data_diff="metadata.ingestion.source.database.databricks.data_diff.data_diff.DatabricksTableParameter",
    connection_class="metadata.ingestion.source.database.databricks.connection.DatabricksConnection",
)
