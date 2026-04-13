from metadata.ingestion.source.database.hive.lineage import HiveLineageSource
from metadata.ingestion.source.database.hive.metadata import HiveSource
from metadata.sampler.sqlalchemy.hive.sampler import HiveSampler
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=HiveSource,
    lineage_source_class=HiveLineageSource,
    sampler_class=HiveSampler,
)
