from metadata.ingestion.source.pipeline.openlineage.connection import OpenLineageConnection
from metadata.ingestion.source.pipeline.openlineage.metadata import OpenlineageSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=OpenlineageSource, connection_class=OpenLineageConnection)  # pyright: ignore[reportArgumentType]
