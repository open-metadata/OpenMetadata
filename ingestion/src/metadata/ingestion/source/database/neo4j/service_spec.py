from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.neo4j.metadata.Neo4jSource",
    connection_class="metadata.ingestion.source.database.neo4j.connection.Neo4jConnection",
)
