from metadata.ingestion.source.database.mysql.metadata import MysqlSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=MysqlSource)
