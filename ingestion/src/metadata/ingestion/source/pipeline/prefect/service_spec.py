from metadata.ingestion.source.pipeline.prefect.connection import PrefectConnection
from metadata.ingestion.source.pipeline.prefect.metadata import PrefectSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=PrefectSource, connection_class=PrefectConnection)  # pyright: ignore[reportArgumentType]
