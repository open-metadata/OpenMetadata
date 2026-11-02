from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.doris.metadata.DorisSource",
    lineage_source_class="metadata.ingestion.source.database.doris.lineage.DorisLineageSource",
    connection_class="metadata.ingestion.source.database.doris.connection.DorisConnection",
)
