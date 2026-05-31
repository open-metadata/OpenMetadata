from metadata.ingestion.source.storage.s3.metadata import S3Source
from metadata.sampler.storage.s3.sampler import S3Sampler
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=S3Source, sampler_class=S3Sampler)
