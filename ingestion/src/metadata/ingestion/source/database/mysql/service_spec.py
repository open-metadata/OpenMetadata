from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.mysql.metadata.MysqlSource",
    lineage_source_class="metadata.ingestion.source.database.mysql.lineage.MysqlLineageSource",
    usage_source_class="metadata.ingestion.source.database.mysql.usage.MysqlUsageSource",
    connection_class="metadata.ingestion.source.database.mysql.connection.MySQLConnection",
)
