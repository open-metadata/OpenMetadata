from metadata.ingestion.source.database.domodatabase.connection import DomoDatabaseConnection
from metadata.ingestion.source.database.domodatabase.metadata import DomodatabaseSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=DomodatabaseSource,  # pyright: ignore[reportArgumentType]
    connection_class=DomoDatabaseConnection,  # pyright: ignore[reportArgumentType]
)
