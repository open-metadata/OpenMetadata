from metadata.ingestion.source.dashboard.powerbi.connection import PowerBIConnection
from metadata.ingestion.source.dashboard.powerbi.metadata import PowerbiSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=PowerbiSource, connection_class=PowerBIConnection)  # pyright: ignore[reportArgumentType]
