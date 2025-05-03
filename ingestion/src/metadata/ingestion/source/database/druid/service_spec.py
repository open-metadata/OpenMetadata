from metadata.ingestion.source.database.druid.lineage import DruidLineageSource
from metadata.ingestion.source.database.druid.metadata import DruidSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=DruidSource,
    lineage_source_class=DruidLineageSource,
)
