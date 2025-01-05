from metadata.ingestion.source.database.gaussdb.lineage import GaussdbLineageSource
from metadata.ingestion.source.database.gaussdb.metadata import GaussdbSource
from metadata.ingestion.source.database.gaussdb.usage import GaussdbUsageSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=GaussdbSource,
    lineage_source_class=GaussdbLineageSource,
    usage_source_class=GaussdbUsageSource,
)
