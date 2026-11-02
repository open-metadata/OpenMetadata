from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.bigtable.metadata.BigtableSource",
    connection_class="metadata.ingestion.source.database.bigtable.connection.BigTableConnection",
)
