from metadata.ingestion.source.database.mariadb.metadata import MariadbSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=MariadbSource)
