from metadata.ingestion.source.database.oracle.metadata import OracleSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=OracleSource)
