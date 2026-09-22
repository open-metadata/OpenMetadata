from metadata.ingestion.source.dashboard.mode.connection import ModeConnection
from metadata.ingestion.source.dashboard.mode.metadata import ModeSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=ModeSource, connection_class=ModeConnection)  # pyright: ignore[reportArgumentType]
