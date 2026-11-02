from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.redshift.metadata.RedshiftSource",
    lineage_source_class="metadata.ingestion.source.database.redshift.lineage.RedshiftLineageSource",
    usage_source_class="metadata.ingestion.source.database.redshift.usage.RedshiftUsageSource",
    profiler_class="metadata.profiler.interface.sqlalchemy.redshift.profiler_interface.RedshiftProfilerInterface",
    connection_class="metadata.ingestion.source.database.redshift.connection.RedshiftConnection",
)
