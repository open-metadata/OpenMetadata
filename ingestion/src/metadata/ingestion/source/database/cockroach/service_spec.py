from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.cockroach.metadata.CockroachSource",
    connection_class="metadata.ingestion.source.database.cockroach.connection.CockroachConnection",
)
