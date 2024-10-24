from metadata.ingestion.source.database.domodatabase.metadata import DomodatabaseSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=DomodatabaseSource)
