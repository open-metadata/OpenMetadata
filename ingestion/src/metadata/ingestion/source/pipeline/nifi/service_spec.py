from metadata.ingestion.source.pipeline.nifi.metadata import NifiSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=NifiSource)
