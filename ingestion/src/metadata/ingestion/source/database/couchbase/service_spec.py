from metadata.ingestion.source.database.couchbase.metadata import CouchbaseSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=CouchbaseSource)
