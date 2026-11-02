from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.db2.metadata.Db2Source",
    profiler_class="metadata.profiler.interface.sqlalchemy.db2.profiler_interface.DB2ProfilerInterface",
    lineage_source_class="metadata.ingestion.source.database.db2.lineage.Db2LineageSource",
    connection_class="metadata.ingestion.source.database.db2.connection.Db2Connection",
)
