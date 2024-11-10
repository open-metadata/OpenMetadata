from metadata.ingestion.source.metadata.amundsen.metadata import AmundsenSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=AmundsenSource)
