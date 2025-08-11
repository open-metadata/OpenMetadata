from metadata.ingestion.source.pipeline.openlineage.metadata import OpenlineageSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=OpenlineageSource)
