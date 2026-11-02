from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.sas.metadata.SasSource",
    connection_class="metadata.ingestion.source.database.sas.connection.SASConnection",
)
