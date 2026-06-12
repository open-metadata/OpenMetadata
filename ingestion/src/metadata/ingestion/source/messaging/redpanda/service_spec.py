from metadata.ingestion.source.messaging.redpanda.metadata import RedpandaSource
from metadata.sampler.messaging.redpanda.sampler import RedpandaSampler
from metadata.utils.importer import get_class_path
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=RedpandaSource, sampler_class=get_class_path(RedpandaSampler))
