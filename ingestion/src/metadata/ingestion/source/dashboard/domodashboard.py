from typing import Any, Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.services.connections.dashboard.domodashboardConnection import (
    DomoDashboardConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource


class DomodashboardSource(DashboardServiceSource):

    config: WorkflowSource
    metadata: OpenMetadataConnection
    status: SourceStatus

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__(config, metadata_config)
        print("self.connection.client", self.connection.client)
        self.domodashboard_session = self.connection.client

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: DomoDashboardConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, DomoDashboardConnection):
            raise InvalidSourceException(
                f"Expected MetabaseConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboard(self) -> Any:
        print("get_dashboard")
        print("self_get_dashboard", self.client)
        return

    def get_dashboard_details(self, dashboard: Any) -> Any:
        print("get_dashboard_details")
        return

    def get_dashboard_name(self, dashboard_details: Any) -> str:
        print("get_dashboard_name")
        return

    def get_dashboards_list(self) -> Optional[List[Any]]:
        print("get_dashboards_list")
        return

    def yield_dashboard(
        self, dashboard_details: Any
    ) -> Iterable[CreateDashboardRequest]:
        print("yield_dashboard")
        return

    def yield_dashboard_chart(
        self, dashboard_details: Any
    ) -> Optional[Iterable[CreateChartRequest]]:
        print("yield_dashboard_chart")
        return

    def yield_dashboard_lineage_details(
        self, dashboard_details: Any, db_service_name: str
    ) -> Optional[Iterable[AddLineageRequest]]:
        print("yield_dashboard_lineage_details")
        return
