from metadata.ingestion.source.database.mysql.lineage import MySQLLineageSource
from metadata.ingestion.source.database.mysql.metadata import MysqlSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=MysqlSource, lineage_source_class=MySQLLineageSource
)
