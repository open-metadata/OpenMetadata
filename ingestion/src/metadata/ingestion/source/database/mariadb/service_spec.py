from metadata.ingestion.source.database.mariadb.metadata import MariadbSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=MariadbSource)
