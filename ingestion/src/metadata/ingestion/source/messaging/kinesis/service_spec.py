from metadata.ingestion.source.messaging.kinesis.connection import KinesisConnection
from metadata.ingestion.source.messaging.kinesis.metadata import KinesisSource
from metadata.sampler.messaging.kinesis.sampler import KinesisSampler
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(
    metadata_source_class=KinesisSource,  # pyright: ignore[reportArgumentType]
    connection_class=KinesisConnection,  # pyright: ignore[reportArgumentType]
    sampler_class=KinesisSampler,  # pyright: ignore[reportArgumentType]
)
