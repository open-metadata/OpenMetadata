from metadata.ingestion.source.pipeline.fivetran.metadata import FivetranSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=FivetranSource)
