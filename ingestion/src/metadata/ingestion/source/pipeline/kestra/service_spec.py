from metadata.ingestion.source.pipeline.kestra.metadata import KestraSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=KestraSource)
