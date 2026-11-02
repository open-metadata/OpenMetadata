from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    table_binding_resolution_class="metadata.ingestion.source.database.bigquery.resolution.BigQueryTableBindingResolution",
    metadata_source_class="metadata.ingestion.source.database.bigquery.metadata.BigquerySource",
    lineage_source_class="metadata.ingestion.source.database.bigquery.lineage.BigqueryLineageSource",
    usage_source_class="metadata.ingestion.source.database.bigquery.usage.BigqueryUsageSource",
    profiler_class="metadata.profiler.interface.sqlalchemy.bigquery.profiler_interface.BigQueryProfilerInterface",
    sampler_class="metadata.sampler.sqlalchemy.bigquery.sampler.BigQuerySampler",
    connection_class="metadata.ingestion.source.database.bigquery.connection.BigQueryConnection",
)
