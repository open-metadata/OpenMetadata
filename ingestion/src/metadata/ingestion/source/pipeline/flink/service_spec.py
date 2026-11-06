from metadata.ingestion.source.pipeline.flink.connection import FlinkConnection
from metadata.ingestion.source.pipeline.flink.metadata import FlinkSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=FlinkSource, connection_class=FlinkConnection)  # pyright: ignore[reportArgumentType]
