from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.mssql.metadata.MssqlSource",
    lineage_source_class="metadata.ingestion.source.database.mssql.lineage.MssqlLineageSource",
    usage_source_class="metadata.ingestion.source.database.mssql.usage.MssqlUsageSource",
    sampler_class="metadata.sampler.sqlalchemy.mssql.sampler.MssqlSampler",
    data_diff="metadata.ingestion.source.database.mssql.data_diff.data_diff.MssqlTableParameter",
    connection_class="metadata.ingestion.source.database.mssql.connection.MssqlConnection",
)
