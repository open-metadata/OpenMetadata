from metadata.ingestion.source.database.impala.lineage import ImpalaLineageSource
from metadata.ingestion.source.database.impala.metadata import ImpalaSource
from metadata.sampler.sqlalchemy.impala.sampler import ImpalaSampler
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=ImpalaSource,
    lineage_source_class=ImpalaLineageSource,
    sampler_class=ImpalaSampler,
)
