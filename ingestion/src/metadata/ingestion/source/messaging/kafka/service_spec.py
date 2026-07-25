from metadata.ingestion.source.messaging.kafka.connection import KafkaConnection
from metadata.ingestion.source.messaging.kafka.metadata import KafkaSource
from metadata.sampler.messaging.kafka.sampler import KafkaSampler
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(
    metadata_source_class=KafkaSource,  # pyright: ignore[reportArgumentType]
    connection_class=KafkaConnection,  # pyright: ignore[reportArgumentType]
    sampler_class=KafkaSampler,  # pyright: ignore[reportArgumentType]
)
