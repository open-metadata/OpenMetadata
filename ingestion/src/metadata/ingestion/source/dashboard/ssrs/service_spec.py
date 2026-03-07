from metadata.ingestion.source.dashboard.ssrs.metadata import SsrsSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=SsrsSource)
