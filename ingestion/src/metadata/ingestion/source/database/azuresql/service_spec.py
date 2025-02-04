from metadata.ingestion.source.database.azuresql.lineage import AzuresqlLineageSource
from metadata.ingestion.source.database.azuresql.metadata import AzuresqlSource
from metadata.ingestion.source.database.azuresql.usage import AzuresqlUsageSource
from metadata.sampler.sqlalchemy.azuresql.sampler import AzureSQLSampler
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=AzuresqlSource,
    lineage_source_class=AzuresqlLineageSource,
    usage_source_class=AzuresqlUsageSource,
    sampler_class=AzureSQLSampler,
)
