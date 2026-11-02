from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    profiler_class="metadata.profiler.interface.sqlalchemy.exasol.profiler_interface.ExasolProfilerInterface",
    metadata_source_class="metadata.ingestion.source.database.exasol.metadata.ExasolSource",
    lineage_source_class="metadata.ingestion.source.database.exasol.lineage.ExasolLineageSource",
    usage_source_class="metadata.ingestion.source.database.exasol.usage.ExasolUsageSource",
    connection_class="metadata.ingestion.source.database.exasol.connection.ExasolConnection",
)
