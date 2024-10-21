from metadata.ingestion.source.database.saperp.metadata import SaperpSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=SaperpSource)
