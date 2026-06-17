from metadata.ingestion.source.messaging.kafka.connection import KafkaConnection
from metadata.ingestion.source.messaging.kafka.metadata import KafkaSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=KafkaSource, connection_class=KafkaConnection)  # pyright: ignore[reportArgumentType]
