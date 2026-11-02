from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.azuresql.metadata.AzuresqlSource",
    lineage_source_class="metadata.ingestion.source.database.azuresql.lineage.AzuresqlLineageSource",
    usage_source_class="metadata.ingestion.source.database.azuresql.usage.AzuresqlUsageSource",
    sampler_class="metadata.sampler.sqlalchemy.azuresql.sampler.AzureSQLSampler",
    data_diff="metadata.ingestion.source.database.azuresql.data_diff.data_diff.AzureSQLTableParameter",
    connection_class="metadata.ingestion.source.database.azuresql.connection.AzureSQLConnection",
)
