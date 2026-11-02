from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.oracle.metadata.OracleSource",
    lineage_source_class="metadata.ingestion.source.database.oracle.lineage.OracleLineageSource",
    usage_source_class="metadata.ingestion.source.database.oracle.usage.OracleUsageSource",
    connection_class="metadata.ingestion.source.database.oracle.connection.OracleConnection",
)
