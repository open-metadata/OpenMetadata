from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.iomete.metadata.IometeSource",
    lineage_source_class="metadata.ingestion.source.database.iomete.lineage.IometeLineageSource",
    connection_class="metadata.ingestion.source.database.iomete.connection.IometeConnection",
)
