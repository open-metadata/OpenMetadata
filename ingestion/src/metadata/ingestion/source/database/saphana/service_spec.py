from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.saphana.metadata.SaphanaSource",
    lineage_source_class="metadata.ingestion.source.database.saphana.lineage.SaphanaLineageSource",
    connection_class="metadata.ingestion.source.database.saphana.connection.SapHanaConnection",
)
