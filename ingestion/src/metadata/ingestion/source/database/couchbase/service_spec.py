from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.couchbase.metadata.CouchbaseSource",
    connection_class="metadata.ingestion.source.database.couchbase.connection.CouchbaseConnection",
)
