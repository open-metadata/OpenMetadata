from metadata.ingestion.source.metadata.atlas.connection import AtlasConnection
from metadata.ingestion.source.metadata.atlas.metadata import AtlasSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=AtlasSource, connection_class=AtlasConnection)  # pyright: ignore[reportArgumentType]
