from metadata.ingestion.source.database.pinotdb.metadata import PinotdbSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=PinotdbSource)
