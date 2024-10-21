from metadata.ingestion.source.database.oracle.metadata import OracleSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=OracleSource)
