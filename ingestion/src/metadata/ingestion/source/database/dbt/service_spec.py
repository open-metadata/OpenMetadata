from metadata.ingestion.source.database.dbt.metadata import DbtSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=DbtSource)
