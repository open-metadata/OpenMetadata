from metadata.ingestion.source.database.cassandra.metadata import CassandraSource
from metadata.profiler.interface.nosql.profiler_interface import NoSQLProfilerInterface
from metadata.sampler.nosql.sampler import NoSQLSampler
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=CassandraSource,
    profiler_class=NoSQLProfilerInterface,
    sampler_class=NoSQLSampler,
)
