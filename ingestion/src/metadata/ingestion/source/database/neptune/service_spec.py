from metadata.ingestion.source.database.neptune.connection import NeptuneConnection
from metadata.ingestion.source.database.neptune.metadata import NeptuneSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=NeptuneSource,  # pyright: ignore[reportArgumentType]
    connection_class=NeptuneConnection,  # pyright: ignore[reportArgumentType]
)
