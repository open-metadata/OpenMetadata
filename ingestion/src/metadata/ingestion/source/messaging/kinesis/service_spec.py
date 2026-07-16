from metadata.ingestion.source.messaging.kinesis.connection import KinesisConnection
from metadata.ingestion.source.messaging.kinesis.metadata import KinesisSource
from metadata.sampler.messaging.kinesis.sampler import KinesisSampler
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(
    metadata_source_class=KinesisSource,
    connection_class=KinesisConnection,
    sampler_class=KinesisSampler,
)  # pyright: ignore[reportArgumentType]
