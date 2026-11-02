from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    table_binding_resolution_class="metadata.ingestion.source.database.clickhouse.resolution.ClickHouseTableBindingResolution",
    metadata_source_class="metadata.ingestion.source.database.clickhouse.metadata.ClickhouseSource",
    lineage_source_class="metadata.ingestion.source.database.clickhouse.lineage.ClickhouseLineageSource",
    usage_source_class="metadata.ingestion.source.database.clickhouse.usage.ClickhouseUsageSource",
    connection_class="metadata.ingestion.source.database.clickhouse.connection.ClickhouseConnection",
)
