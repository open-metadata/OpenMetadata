from metadata.ingestion.source.database.athena.metadata import AthenaSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=AthenaSource)
