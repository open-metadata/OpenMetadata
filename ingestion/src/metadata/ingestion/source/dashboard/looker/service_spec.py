from metadata.ingestion.source.dashboard.looker.connection import LookerConnection
from metadata.ingestion.source.dashboard.looker.metadata import LookerSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=LookerSource, connection_class=LookerConnection)  # pyright: ignore[reportArgumentType]
