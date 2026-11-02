from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.druid.metadata.DruidSource",
    lineage_source_class="metadata.ingestion.source.database.druid.lineage.DruidLineageSource",
    connection_class="metadata.ingestion.source.database.druid.connection.DruidConnection",
)
