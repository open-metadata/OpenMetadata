from metadata.ingestion.source.database.doris.metadata import DorisSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=DorisSource)
