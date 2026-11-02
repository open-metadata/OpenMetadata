from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.trino.metadata.TrinoSource",
    lineage_source_class="metadata.ingestion.source.database.trino.lineage.TrinoLineageSource",
    usage_source_class="metadata.ingestion.source.database.trino.usage.TrinoUsageSource",
    profiler_class="metadata.profiler.interface.sqlalchemy.trino.profiler_interface.TrinoProfilerInterface",
    sampler_class="metadata.sampler.sqlalchemy.trino.sampler.TrinoSampler",
    data_diff="metadata.ingestion.source.database.trino.data_diff.data_diff.TrinoTableParameter",
    connection_class="metadata.ingestion.source.database.trino.connection.TrinoConnection",
)
