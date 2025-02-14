from metadata.ingestion.source.database.mysql.lineage import MysqlLineageSource
from metadata.ingestion.source.database.mysql.metadata import MysqlSource
from metadata.ingestion.source.database.mysql.usage import MysqlUsageSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=MysqlSource,
    lineage_source_class=MysqlLineageSource,
    usage_source_class=MysqlUsageSource,
)
