from metadata.ingestion.source.pipeline.data360pipeline.connection import (
    Data360PipelineConnection,
)
from metadata.ingestion.source.pipeline.data360pipeline.lineage import (
    Data360PipelineLineageSource,
)
from metadata.ingestion.source.pipeline.data360pipeline.metadata import (
    Data360PipelineSource,
)
from metadata.ingestion.source.pipeline.data360pipeline.operational import (
    Data360PipelineOperationalSource,
)
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(
    metadata_source_class=Data360PipelineSource,  # pyright: ignore[reportArgumentType]
    lineage_source_class=Data360PipelineLineageSource,  # pyright: ignore[reportArgumentType]
    usage_source_class=Data360PipelineOperationalSource,  # pyright: ignore[reportArgumentType]
    connection_class=Data360PipelineConnection,  # pyright: ignore[reportArgumentType]
)
