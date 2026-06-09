from metadata.ingestion.source.database.cockroach.connection import CockroachConnection
from metadata.ingestion.source.database.cockroach.metadata import CockroachSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=CockroachSource,
    connection_class=CockroachConnection,
)
