from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.postgres.metadata.PostgresSource",
    lineage_source_class="metadata.ingestion.source.database.postgres.lineage.PostgresLineageSource",
    usage_source_class="metadata.ingestion.source.database.postgres.usage.PostgresUsageSource",
    connection_class="metadata.ingestion.source.database.postgres.connection.PostgresConnection",
)
