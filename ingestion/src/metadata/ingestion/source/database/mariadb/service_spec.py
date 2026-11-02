from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.mariadb.metadata.MariadbSource",
    lineage_source_class="metadata.ingestion.source.database.mariadb.lineage.MariadbLineageSource",
    profiler_class="metadata.profiler.interface.sqlalchemy.mariadb.profiler_interface.MariaDBProfilerInterface",
    connection_class="metadata.ingestion.source.database.mariadb.connection.MariaDBConnection",
)
