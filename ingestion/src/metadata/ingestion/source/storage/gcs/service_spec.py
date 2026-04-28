from metadata.ingestion.source.storage.gcs.metadata import GcsSource
from metadata.sampler.storage.gcs.sampler import GCSSampler
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=GcsSource, sampler_class=GCSSampler)
