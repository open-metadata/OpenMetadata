from metadata.ingestion.source.database.data360.connection import Data360Connection
from metadata.ingestion.source.database.data360.metadata import Data360Source
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=Data360Source,  # pyright: ignore[reportArgumentType]
    connection_class=Data360Connection,  # pyright: ignore[reportArgumentType]
)
