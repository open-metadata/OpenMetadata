from metadata.ingestion.source.database.bigtable.metadata import BigtableSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=BigtableSource)
