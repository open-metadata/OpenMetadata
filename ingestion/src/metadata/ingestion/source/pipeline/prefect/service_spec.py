from metadata.ingestion.source.pipeline.prefect.metadata import PrefectSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=PrefectSource)
