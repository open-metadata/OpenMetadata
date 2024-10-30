from metadata.ingestion.source.storage.s3.metadata import S3Source
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=S3Source)
