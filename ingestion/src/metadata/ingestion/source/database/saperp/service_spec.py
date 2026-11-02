from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.saperp.metadata.SaperpSource",
    connection_class="metadata.ingestion.source.database.saperp.connection.SapErpConnection",
)
