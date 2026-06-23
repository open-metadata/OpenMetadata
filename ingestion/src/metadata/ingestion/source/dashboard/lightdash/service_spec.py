from metadata.ingestion.source.dashboard.lightdash.connection import LightdashConnection
from metadata.ingestion.source.dashboard.lightdash.metadata import LightdashSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=LightdashSource, connection_class=LightdashConnection)  # pyright: ignore[reportArgumentType]
