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
from typing import Any, Iterable, List, Optional

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
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_source import DashboardSourceService
from metadata.ingestion.source.database.common_db_source import SQLSourceStatus
from metadata.utils.connections import get_connection
from metadata.utils.filters import filter_by_chart
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PowerbiSource(DashboardSourceService):
    """PowerBi entity class
    Args:
        config:
        metadata_config:
    Attributes:
        config:
        metadata_config:
        charts:
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)

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

    def get_dashboards_list(self) -> Optional[List[dict]]:
        """
        Get List of all dashboards
        """
        self.dashboards = self.client.fetch_dashboards().get("value")
        return self.dashboards

    def get_dashboard_name(self, dashboard_details: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard_details["displayName"]

    def get_dashboard_details(self, dashboard: dict) -> dict:
        """
        Get Dashboard Details
        """
        return dashboard

    def get_dashboard_entity(self, dashboard_details: dict) -> Dashboard:
        """
        Method to Get Dashboard Entity, Dashboard Charts & Lineage
        """
        yield from self.fetch_dashboard_charts(dashboard_details)
        yield Dashboard(
            name=dashboard_details["id"],
            url=dashboard_details["webUrl"],
            displayName=dashboard_details["displayName"],
            description="",
            charts=[chart["id"] for chart in self.charts],
            service=EntityReference(id=self.service.id, type="dashboardService"),
        )

    def get_lineage(self, dashboard_details: Any) -> Optional[AddLineageRequest]:
        """
        Get lineage between dashboard and data sources
        """
        metadata = OpenMetadata(self.metadata_config)
        charts = self.client.fetch_charts(dashboard_id=dashboard_details["id"]).get(
            "value"
        )
        for chart in charts:
            dataset_id = chart.get("datasetId")
            if dataset_id:
                print("dataset_id: " + dataset_id)
                dataset = self.client.fetch_dataset_by_id(dataset_id=dataset_id)
                print(dataset)

    def process_charts(self) -> Iterable[Chart]:
        """
        Method to fetch Charts
        """
        logger.info("Fetch Charts Not implemented for PowerBi")
        yield []

    def fetch_dashboard_charts(self, dashboard_details: dict) -> Iterable[Chart]:
        """Get chart method
        Args:
            dashboard_details:
        Returns:
            Iterable[Chart]
        """
        self.charts = []
        charts = self.client.fetch_charts(dashboard_id=dashboard_details["id"]).get(
            "value"
        )

        for chart in charts:
            try:
                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart["title"]
                ):
                    self.status.filter(
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
                        id=self.service.id, type="dashboardService"
                    ),
                )
                self.charts.append(chart)
                self.status.scanned(chart["title"])
            except Exception as err:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.error(repr(err))
                self.status.failure(chart["title"], repr(err))
