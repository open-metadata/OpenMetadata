from metadata.ingestion.source.messaging.kinesis.connection import KinesisConnection
from metadata.ingestion.source.messaging.kinesis.metadata import KinesisSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=KinesisSource, connection_class=KinesisConnection)  # pyright: ignore[reportArgumentType]
