from metadata.ingestion.source.database.mongodb.metadata import MongodbSource
from metadata.profiler.interface.nosql.profiler_interface import NoSQLProfilerInterface
from metadata.sampler.nosql.sampler import NoSQLSampler
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=MongodbSource,
    profiler_class=NoSQLProfilerInterface,
    sampler_class=NoSQLSampler,
)
