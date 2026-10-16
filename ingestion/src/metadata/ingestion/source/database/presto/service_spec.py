from metadata.ingestion.source.database.presto.connection import PrestoConnection
from metadata.ingestion.source.database.presto.metadata import PrestoSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=PrestoSource,  # type: ignore
    connection_class=PrestoConnection,  # pyright: ignore[reportArgumentType]
)
