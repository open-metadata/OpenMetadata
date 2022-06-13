from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Iterable, List, Optional, Union

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.connections import get_connection, test_connection
from metadata.utils.filters import filter_by_dashboard
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


@dataclass
class DashboardSourceStatus(SourceStatus):
    """
    Reports the source status after ingestion
    """

    def scanned(self, record: str) -> None:
        self.success.append(record)
        logger.info(f"Scanned: {record}")

    def filter(self, record: str, err: str) -> None:
        self.filtered.append(record)
        logger.warning(f"Filtered {record}: {err}")


class DashboardSourceService(Source, ABC):
    @abstractmethod
    def get_dashboards_list(self) -> Optional[List[Any]]:
        """
        Get List of all dashboards
        """

    @abstractmethod
    def get_dashboard_name(self, dashboard_details: Any) -> str:
        """
        Get Dashboard Name
        """

    @abstractmethod
    def get_dashboard_details(self, dashboard: Any) -> Any:
        """
        Get Dashboard Details
        """

    @abstractmethod
    def get_dashboard_entity(self, dashboard_details: Any) -> CreateDashboardRequest:
        """
        Method to Get Dashboard Entity
        """

    @abstractmethod
    def get_lineage(self, dashboard_details: Any) -> Optional[AddLineageRequest]:
        """
        Get lineage between dashboard and data sources
        """

    @abstractmethod
    def fetch_dashboard_charts(
        self, dashboard: Any
    ) -> Optional[Iterable[CreateChartRequest]]:
        """
        Method to fetch charts linked to dashboard
        """

    @abstractmethod
    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service_connection = self.config.serviceConnection.__root__.config
        self.source_config: DashboardServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.connection = get_connection(self.service_connection)
        self.test_connection()

        self.client = self.connection.client
        self.service = self.metadata.get_service_or_create(
            entity=DashboardService, config=config
        )
        self.status = DashboardSourceStatus()
        self.metadata_client = OpenMetadata(self.metadata_config)

    def next_record(self) -> Iterable[Entity]:
        yield from self.process_dashboards()

    def process_dashboards(
        self,
    ) -> Iterable[Union[CreateDashboardRequest, CreateChartRequest, AddLineageRequest]]:
        """Get dashboard method"""
        for dashboard in self.get_dashboards_list():
            try:
                dashboard_details = self.get_dashboard_details(dashboard)
                if filter_by_dashboard(
                    self.source_config.dashboardFilterPattern,
                    self.get_dashboard_name(dashboard_details),
                ):
                    self.status.filter(
                        self.get_dashboard_name(dashboard),
                        "Dashboard Pattern not Allowed",
                    )
                    continue
                yield from self.fetch_dashboard_charts(dashboard_details) or []
                yield from self.get_dashboard_entity(dashboard_details)
                if self.source_config.dbServiceName:
                    yield from self.get_lineage(dashboard_details)
            except Exception as err:
                logger.error(repr(err))
                self.status.failure(self.get_dashboard_name(dashboard), repr(err))

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass

    def test_connection(self) -> None:
        test_connection(self.connection)

    def prepare(self):
        pass
