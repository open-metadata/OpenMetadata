#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""PowerBI source module"""

import traceback
import uuid
from typing import Iterable, List, Optional

from powerbi.client import PowerBiClient

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.filters import filter_by_chart, filter_by_dashboard
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PowerbiSource(Source[Entity]):
    """Powerbi entity class

    Args:
        config:
        metadata_config:
    Attributes:
        config:
        metadata_config:
        status:
        dashboard_service:
        charts:
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)

        self.client = PowerBiClient(
            client_id=self.service_connection_config.clientId,
            client_secret=self.service_connection_config.clientSecret.get_secret_value(),
            scope=self.service_connection_config.scope,
            redirect_uri=self.service_connection_config.redirectURI,
            credentials=self.service_connection_config.credentials,
        )

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        """Instantiate object

        Args:
            config_dict:
            metadata_config:
        Returns:
            PowerBiSource
        """
        config = WorkflowSource.parse_obj(config_dict)
        connection: PowerBIConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, PowerBIConnection):
            raise InvalidSourceException(
                f"Expected PowerBIConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboards_list(self) -> Optional[List[object]]:
        """
        Get List of all dashboards
        """
        self.dashboard_service = self.client.dashboards()
        dashboard_list = self.dashboard_service.get_dashboards()
        return dashboard_list.get("value")

    def get_dashboard_name(self, dashboard_details: object) -> str:
        """
        Get Dashboard Name
        """
        return dashboard_details["id"]

    def get_dashboard_details(self, dashboard: object) -> object:
        """
        Get Dashboard Details
        """
        return self.dashboard_service.get_dashboard(dashboard["id"])

    def get_dashboard_entity(self, dashboard_details: object) -> Dashboard:
        """
        Method to Get Dashboard Entity, Dashboard Charts & Lineage
        """
        return Dashboard(
            name=dashboard_details["id"],
            url=dashboard_details["webUrl"],
            displayName=dashboard_details["displayName"],
            description="",
            charts=self.charts,
            service=EntityReference(
                id=self.dashboard_service.id, type="dashboardService"
            ),
        )

    def get_lineage(
        self, datasource_list: List, dashboard_name: str
    ) -> AddLineageRequest:
        """
        Get lineage between dashboard and data sources
        """
        logger.info("Lineage not implemented for Looker")

    def fetch_charts(self) -> Iterable[Chart]:
        """
        Metod to fetch Charts
        """
        logger.info("Fetch Charts Not implemented for Looker")

    def fetch_dashboard_charts(self, dashboard_details: object) -> Iterable[Chart]:
        """Get chart method
        Args:
            charts:
        Returns:
            Iterable[Chart]
        """
        self.charts = []
        charts = self.dashboard_service.get_tiles(
            dashboard_id=dashboard_details["id"]
        ).get("value")

        for chart in charts:
            try:
                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart["title"]
                ):
                    self.status.failure(
                        chart["title"], "Filtered out using Chart filter pattern"
                    )
                    continue
                yield Chart(
                    id=uuid.uuid4(),
                    name=chart["id"],
                    displayName=chart["title"],
                    description="",
                    chart_type="",
                    url=chart["embedUrl"],
                    service=EntityReference(
                        id=self.dashboard_service.id, type="dashboardService"
                    ),
                )
                self.charts.append(chart["id"])
                self.status.scanned(chart["title"])
            except Exception as err:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.error(repr(err))
                self.status.failure(chart["title"], repr(err))
