from metadata.ingestion.source.metadata.atlas.metadata import AtlasSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=AtlasSource)
