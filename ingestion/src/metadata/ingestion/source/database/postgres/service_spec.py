from metadata.ingestion.source.database.postgres.metadata import PostgresSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=PostgresSource)
