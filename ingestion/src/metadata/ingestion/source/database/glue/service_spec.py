from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.glue.metadata.GlueSource",
    connection_class="metadata.ingestion.source.database.glue.connection.GlueConnection",
)
