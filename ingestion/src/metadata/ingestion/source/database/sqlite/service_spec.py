from metadata.ingestion.source.database.sqlite.connection import SQLiteConnection
from metadata.ingestion.source.database.sqlite.lineage import SqliteLineageSource
from metadata.ingestion.source.database.sqlite.metadata import SqliteSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=SqliteSource,
    lineage_source_class=SqliteLineageSource,
    connection_class=SQLiteConnection,  # pyright: ignore[reportArgumentType]
)
