from metadata.ingestion.source.database.iceberg.metadata import IcebergSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=IcebergSource)
