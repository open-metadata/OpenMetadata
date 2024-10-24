from metadata.ingestion.source.metadata.alationsink.metadata import AlationsinkSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=AlationsinkSource)
