"""ClickZetta service specification."""

from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.clickzetta.metadata.ClickzettaSource",
    lineage_source_class="metadata.ingestion.source.database.clickzetta.lineage.ClickzettaLineageSource",
    usage_source_class="metadata.ingestion.source.database.clickzetta.usage.ClickzettaUsageSource",
    connection_class="metadata.ingestion.source.database.clickzetta.connection.ClickzettaConnection",
    sampler_class="metadata.sampler.sqlalchemy.clickzetta.sampler.ClickzettaSampler",
    data_diff="metadata.ingestion.source.database.clickzetta.data_diff.table_parameter.ClickzettaTableParameter",
)
