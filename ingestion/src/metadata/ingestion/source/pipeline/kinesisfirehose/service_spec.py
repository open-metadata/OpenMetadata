from metadata.ingestion.source.pipeline.kinesisfirehose.metadata import (
    FirehoseSource,
)
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=FirehoseSource)
