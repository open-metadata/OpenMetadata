from metadata.ingestion.source.api.rest.connection import RestConnection
from metadata.ingestion.source.api.rest.metadata import RestSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=RestSource, connection_class=RestConnection)  # pyright: ignore[reportArgumentType]
