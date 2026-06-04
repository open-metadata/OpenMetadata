from metadata.ingestion.source.database.ydb.lineage import YdbLineageSource
from metadata.ingestion.source.database.ydb.metadata import YdbSource
from metadata.sampler.sqlalchemy.ydb.sampler import YdbSampler
from metadata.utils.importer import get_class_path
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=YdbSource,
    lineage_source_class=YdbLineageSource,
    sampler_class=get_class_path(YdbSampler),
)
