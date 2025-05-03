from metadata.ingestion.source.storage.gcs.metadata import GcsSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=GcsSource)
