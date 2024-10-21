from metadata.ingestion.source.database.domodatabase.metadata import DomodatabaseSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=DomodatabaseSource)
