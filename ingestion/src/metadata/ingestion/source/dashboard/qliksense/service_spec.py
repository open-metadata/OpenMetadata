from metadata.ingestion.source.dashboard.qliksense.metadata import QliksenseSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=QliksenseSource)
