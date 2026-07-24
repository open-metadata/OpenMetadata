from metadata.ingestion.source.pipeline.gluepipeline.connection import GluePipelineConnection
from metadata.ingestion.source.pipeline.gluepipeline.metadata import GluepipelineSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=GluepipelineSource, connection_class=GluePipelineConnection)  # pyright: ignore[reportArgumentType]
