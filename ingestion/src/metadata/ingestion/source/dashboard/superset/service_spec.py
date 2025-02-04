from metadata.ingestion.source.dashboard.superset.metadata import SupersetSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=SupersetSource)
