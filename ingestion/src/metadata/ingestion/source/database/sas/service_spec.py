from metadata.ingestion.source.database.sas.metadata import SasSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=SasSource)
