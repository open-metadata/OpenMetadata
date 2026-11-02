from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.cassandra.metadata.CassandraSource",
    profiler_class="metadata.profiler.interface.nosql.profiler_interface.NoSQLProfilerInterface",
    sampler_class="metadata.sampler.nosql.sampler.NoSQLSampler",
    connection_class="metadata.ingestion.source.database.cassandra.connection.CassandraConnection",
)
