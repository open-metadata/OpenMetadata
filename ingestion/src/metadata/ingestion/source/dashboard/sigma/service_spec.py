from metadata.ingestion.source.dashboard.sigma.metadata import SigmaSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=SigmaSource)
