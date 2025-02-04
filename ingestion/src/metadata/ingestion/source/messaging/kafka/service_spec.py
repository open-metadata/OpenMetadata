from metadata.ingestion.source.messaging.kafka.metadata import KafkaSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=KafkaSource)
