from metadata.ingestion.source.dashboard.quicksight.metadata import QuicksightSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=QuicksightSource)
