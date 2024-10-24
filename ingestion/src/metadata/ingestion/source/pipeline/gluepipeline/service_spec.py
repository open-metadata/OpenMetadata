from metadata.ingestion.source.pipeline.gluepipeline.metadata import GluepipelineSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=GluepipelineSource)
