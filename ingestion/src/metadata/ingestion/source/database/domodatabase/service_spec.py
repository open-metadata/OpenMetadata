from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.domodatabase.metadata.DomodatabaseSource",
    connection_class="metadata.ingestion.source.database.domodatabase.connection.DomoDatabaseConnection",
)
