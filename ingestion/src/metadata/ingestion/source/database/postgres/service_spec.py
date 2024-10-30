from metadata.ingestion.source.database.postgres.lineage import PostgresLineageSource
from metadata.ingestion.source.database.postgres.metadata import PostgresSource
from metadata.ingestion.source.database.postgres.usage import PostgresUsageSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=PostgresSource,
    lineage_source_class=PostgresLineageSource,
    usage_source_class=PostgresUsageSource,
)
