from metadata.ingestion.source.dashboard.domodashboard.metadata import (
    DomodashboardSource,
)
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=DomodashboardSource)
