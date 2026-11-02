from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.hive.metadata.HiveSource",
    lineage_source_class="metadata.ingestion.source.database.hive.lineage.HiveLineageSource",
    connection_class="metadata.ingestion.source.database.hive.connection.HiveConnection",
)
