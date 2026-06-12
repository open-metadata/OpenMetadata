from metadata.ingestion.source.messaging.kafka.metadata import KafkaSource
from metadata.sampler.messaging.kafka.sampler import KafkaSampler
from metadata.utils.importer import get_class_path
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=KafkaSource, sampler_class=get_class_path(KafkaSampler))
