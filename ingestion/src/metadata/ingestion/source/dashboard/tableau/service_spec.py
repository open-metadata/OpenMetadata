from metadata.ingestion.source.dashboard.tableau.metadata import TableauSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=TableauSource)
