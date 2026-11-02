from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.impala.metadata.ImpalaSource",
    lineage_source_class="metadata.ingestion.source.database.impala.lineage.ImpalaLineageSource",
    connection_class="metadata.ingestion.source.database.impala.connection.ImpalaConnection",
)
