from metadata.ingestion.source.dashboard.mode.metadata import ModeSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=ModeSource)
