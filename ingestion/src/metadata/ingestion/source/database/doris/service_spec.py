from metadata.ingestion.source.database.doris.metadata import DorisSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=DorisSource)
