from metadata.ingestion.source.database.saperp.connection import SapErpConnection
from metadata.ingestion.source.database.saperp.metadata import SaperpSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=SaperpSource,  # pyright: ignore[reportArgumentType]
    connection_class=SapErpConnection,  # pyright: ignore[reportArgumentType]
)
