from metadata.ingestion.source.dashboard.redash.connection import RedashConnection
from metadata.ingestion.source.dashboard.redash.metadata import RedashSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=RedashSource, connection_class=RedashConnection)  # pyright: ignore[reportArgumentType]
