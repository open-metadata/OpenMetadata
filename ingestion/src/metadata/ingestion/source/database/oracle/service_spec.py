from metadata.ingestion.source.database.oracle.lineage import OracleLineageSource
from metadata.ingestion.source.database.oracle.metadata import OracleSource
from metadata.ingestion.source.database.oracle.usage import OracleUsageSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=OracleSource,
    lineage_source_class=OracleLineageSource,
    usage_source_class=OracleUsageSource,
)
