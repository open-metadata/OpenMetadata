from metadata.ingestion.source.database.presto.metadata import PrestoSource
from metadata.sampler.sqlalchemy.presto.sampler import PrestoSampler
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=PrestoSource,
    sampler_class=PrestoSampler,
)
