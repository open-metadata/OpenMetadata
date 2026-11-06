from metadata.ingestion.source.dashboard.metabase.connection import MetabaseConnection
from metadata.ingestion.source.dashboard.metabase.metadata import MetabaseSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=MetabaseSource, connection_class=MetabaseConnection)  # pyright: ignore[reportArgumentType]
