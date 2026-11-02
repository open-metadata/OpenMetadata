from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.timescale.metadata.TimescaleSource",
    lineage_source_class="metadata.ingestion.source.database.timescale.lineage.TimescaleLineageSource",
    usage_source_class="metadata.ingestion.source.database.timescale.usage.TimescaleUsageSource",
    connection_class="metadata.ingestion.source.database.timescale.connection.TimescaleConnection",
    sampler_class="metadata.sampler.sqlalchemy.timescale.sampler.TimescaleSampler",
)
