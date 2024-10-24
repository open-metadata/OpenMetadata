from metadata.ingestion.source.database.saperp.metadata import SaperpSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=SaperpSource)
