from metadata.ingestion.source.database.deltalake.metadata import DeltalakeSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=DeltalakeSource)
