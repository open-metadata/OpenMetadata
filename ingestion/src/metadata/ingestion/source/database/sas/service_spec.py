from metadata.ingestion.source.database.sas.metadata import SasSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=SasSource)
