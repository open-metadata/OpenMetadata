from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.sqlite.metadata.SqliteSource",
    lineage_source_class="metadata.ingestion.source.database.sqlite.lineage.SqliteLineageSource",
    connection_class="metadata.ingestion.source.database.sqlite.connection.SQLiteConnection",
)
