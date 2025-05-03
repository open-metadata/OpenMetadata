from metadata.ingestion.source.database.couchbase.metadata import CouchbaseSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=CouchbaseSource)
