from metadata.ingestion.source.pipeline.databrickspipeline.metadata import (
    DatabrickspipelineSource,
)
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=DatabrickspipelineSource)
