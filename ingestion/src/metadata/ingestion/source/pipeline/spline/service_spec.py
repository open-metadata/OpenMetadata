from metadata.ingestion.source.pipeline.spline.metadata import SplineSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=SplineSource)
