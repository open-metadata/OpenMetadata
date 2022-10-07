import traceback
from typing import Any, Iterable, List, Optional

from metadata.clients.domodashboard_client import DomoDashboardClient
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
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DomodashboardSource(DashboardServiceSource):

    config: WorkflowSource
    metadata: OpenMetadataConnection
    status: SourceStatus

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__(config, metadata_config)
        self.domo_client = self.connection.client
        self.client = DomoDashboardClient(self.service_connection)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: DomoDashboardConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, DomoDashboardConnection):
            raise InvalidSourceException(
                f"Expected MetabaseConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboards_list(self) -> Optional[List[dict]]:
        dashboards = self.domo_client.page_list()
        return dashboards

    def get_dashboard_name(self, dashboard_details: dict) -> str:
        return dashboard_details["name"]

    def get_dashboard_details(self, dashboard: dict) -> dict:
        return dashboard

    def yield_dashboard(
        self, dashboard_details: dict
    ) -> Iterable[CreateDashboardRequest]:
        dashboard_url = (
            f"{self.service_connection.sandboxDomain}/page/{dashboard_details['id']}"
        )

        yield CreateDashboardRequest(
            name=dashboard_details["name"],
            dashboardUrl=dashboard_url,
            displayName=dashboard_details["name"],
            description=dashboard_details.get("description", ""),
            charts=[
                EntityReference(id=chart.id.__root__, type="chart")
                for chart in self.context.charts
            ],
            service=EntityReference(
                id=self.context.dashboard_service.id.__root__, type="dashboardService"
            ),
        )

    def yield_dashboard_chart(
        self, dashboard_details: Any
    ) -> Optional[Iterable[CreateChartRequest]]:
        charts = self.client.get_chart_details(page_id=dashboard_details["id"])
        for chart in charts["cards"]:
            try:
                chart_url = f"{self.service_connection.sandboxDomain}/page/{charts['id']}/{chart['type']}/details/{chart['id']}"

                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart["title"]
                ):
                    self.status.filter(chart["title"], "Chart Pattern not allowed")
                    continue

                yield CreateChartRequest(
                    name=chart["title"],
                    description=chart.get("description", ""),
                    displayName=chart["title"],
                    chartType=get_standard_chart_type(
                        chart["metadata"].get("chartType") or ""
                    ).value,
                    chartUrl=chart_url,
                    service=EntityReference(
                        id=self.context.dashboard_service.id.__root__,
                        type="dashboardService",
                    ),
                )
                self.status.scanned(chart["title"])
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error creating chart [{chart}]: {exc}")
                continue

    def yield_dashboard_lineage_details(
        self, dashboard_details: dict, db_service_name
    ) -> Optional[Iterable[AddLineageRequest]]:
        return
