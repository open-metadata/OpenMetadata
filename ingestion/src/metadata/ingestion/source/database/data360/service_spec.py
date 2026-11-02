from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.data360.metadata.Data360Source",
    connection_class="metadata.ingestion.source.database.data360.connection.Data360Connection",
)
