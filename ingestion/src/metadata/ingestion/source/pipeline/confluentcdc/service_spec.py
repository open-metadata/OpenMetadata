from metadata.ingestion.source.pipeline.confluentcdc.metadata import ConfluentcdcSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=ConfluentcdcSource)
