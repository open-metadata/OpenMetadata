from metadata.ingestion.source.database.starrocks.metadata import StarRocksSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=StarRocksSource)
