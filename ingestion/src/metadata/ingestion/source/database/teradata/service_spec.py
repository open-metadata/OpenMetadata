from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.teradata.metadata.TeradataSource",
    lineage_source_class="metadata.ingestion.source.database.teradata.lineage.TeradataLineageSource",
    usage_source_class="metadata.ingestion.source.database.teradata.usage.TeradataUsageSource",
    connection_class="metadata.ingestion.source.database.teradata.connection.TeradataConnection",
)
