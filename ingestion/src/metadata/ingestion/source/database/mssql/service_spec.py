from metadata.ingestion.source.database.mssql.lineage import MssqlLineageSource
from metadata.ingestion.source.database.mssql.metadata import MssqlSource
from metadata.ingestion.source.database.mssql.usage import MssqlUsageSource
from metadata.sampler.sqlalchemy.mssql.sampler import MssqlSampler
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=MssqlSource,
    lineage_source_class=MssqlLineageSource,
    usage_source_class=MssqlUsageSource,
    sampler_class=MssqlSampler,
)
