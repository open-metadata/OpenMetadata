from metadata.ingestion.source.database.couchbase.connection import CouchbaseConnection
from metadata.ingestion.source.database.couchbase.metadata import CouchbaseSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=CouchbaseSource,  # pyright: ignore[reportArgumentType]
    connection_class=CouchbaseConnection,  # pyright: ignore[reportArgumentType]
)
