from metadata.ingestion.source.dashboard.mstr.metadata import MstrSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=MstrSource)
