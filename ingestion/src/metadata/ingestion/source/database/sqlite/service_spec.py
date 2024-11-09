from metadata.ingestion.source.database.sqlite.metadata import SqliteSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=SqliteSource)
