from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.pinotdb.metadata.PinotdbSource",
    lineage_source_class="metadata.ingestion.source.database.pinotdb.lineage.PinotdbLineageSource",
    connection_class="metadata.ingestion.source.database.pinotdb.connection.PinotDBConnection",
)
