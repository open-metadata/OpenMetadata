from metadata.ingestion.source.pipeline.airbyte.metadata import AirbyteSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=AirbyteSource)
