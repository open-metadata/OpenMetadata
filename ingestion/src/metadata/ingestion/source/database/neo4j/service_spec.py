from metadata.ingestion.source.database.neo4j.connection import Neo4jConnection
from metadata.ingestion.source.database.neo4j.metadata import Neo4jSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=Neo4jSource,  # pyright: ignore[reportArgumentType]
    connection_class=Neo4jConnection,  # pyright: ignore[reportArgumentType]
)
