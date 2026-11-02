from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.presto.metadata.PrestoSource",  # type: ignore
    connection_class="metadata.ingestion.source.database.presto.connection.PrestoConnection",
)
