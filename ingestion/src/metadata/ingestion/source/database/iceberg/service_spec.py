from metadata.ingestion.source.database.iceberg.metadata import IcebergSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=IcebergSource)
