from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.greenplum.metadata.GreenplumSource",
    lineage_source_class="metadata.ingestion.source.database.greenplum.lineage.GreenplumLineageSource",
    connection_class="metadata.ingestion.source.database.greenplum.connection.GreenplumConnection",
)
