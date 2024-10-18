from metadata.ingestion.source.database.sqlite.metadata import SqliteSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=SqliteSource)
