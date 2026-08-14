from metadata.ingestion.source.dashboard.domodashboard.connection import DomoDashboardConnection
from metadata.ingestion.source.dashboard.domodashboard.metadata import (
    DomodashboardSource,
)
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=DomodashboardSource, connection_class=DomoDashboardConnection)  # pyright: ignore[reportArgumentType]
