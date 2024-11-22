from metadata.ingestion.source.dashboard.metabase.metadata import MetabaseSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=MetabaseSource)
