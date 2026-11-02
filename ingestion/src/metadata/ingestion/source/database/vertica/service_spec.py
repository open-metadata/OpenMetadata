from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.vertica.metadata.VerticaSource",
    lineage_source_class="metadata.ingestion.source.database.vertica.lineage.VerticaLineageSource",
    usage_source_class="metadata.ingestion.source.database.vertica.usage.VerticaUsageSource",
    connection_class="metadata.ingestion.source.database.vertica.connection.VerticaConnection",
)
