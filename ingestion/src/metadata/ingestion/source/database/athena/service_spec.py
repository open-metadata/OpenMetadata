from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.athena.metadata.AthenaSource",
    lineage_source_class="metadata.ingestion.source.database.athena.lineage.AthenaLineageSource",
    usage_source_class="metadata.ingestion.source.database.athena.usage.AthenaUsageSource",
    profiler_class="metadata.profiler.interface.sqlalchemy.athena.profiler_interface.AthenaProfilerInterface",
    connection_class="metadata.ingestion.source.database.athena.connection.AthenaConnection",
)
