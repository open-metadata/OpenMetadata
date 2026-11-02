from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.singlestore.metadata.SinglestoreSource",
    profiler_class="metadata.profiler.interface.sqlalchemy.single_store.profiler_interface.SingleStoreProfilerInterface",
    lineage_source_class="metadata.ingestion.source.database.singlestore.lineage.SinglestoreLineageSource",
    connection_class="metadata.ingestion.source.database.singlestore.connection.SingleStoreConnection",
)
