from metadata.ingestion.source.pipeline.domopipeline.metadata import DomopipelineSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=DomopipelineSource)
