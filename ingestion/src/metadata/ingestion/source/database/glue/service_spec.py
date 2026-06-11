from metadata.ingestion.source.database.glue.connection import GlueConnection
from metadata.ingestion.source.database.glue.metadata import GlueSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=GlueSource,
    connection_class=GlueConnection,  # pyright: ignore[reportArgumentType]
)
