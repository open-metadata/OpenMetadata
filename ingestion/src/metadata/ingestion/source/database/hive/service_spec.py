from metadata.ingestion.source.database.hive.metadata import HiveSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=HiveSource)
