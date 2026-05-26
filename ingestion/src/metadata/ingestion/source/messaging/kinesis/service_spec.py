from metadata.ingestion.source.messaging.kinesis.metadata import KinesisSource
from metadata.sampler.messaging.kinesis.sampler import KinesisSampler
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(
    metadata_source_class=KinesisSource,
    sampler_class=KinesisSampler,
)
