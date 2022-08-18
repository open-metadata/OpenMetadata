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
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PowerbiSource(DashboardServiceSource):
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

    def yield_dashboard(
        self, dashboard_details: dict
    ) -> Iterable[CreateDashboardRequest]:
        """
        Method to Get Dashboard Entity, Dashboard Charts & Lineage
        """
        yield CreateDashboardRequest(
            name=dashboard_details["id"],
            # PBI has no hostPort property. All URL details are present in the webUrl property.
            dashboardUrl=dashboard_details["webUrl"],
            displayName=dashboard_details["displayName"],
            description="",
            charts=[
                EntityReference(id=chart.id.__root__, type="chart")
                for chart in self.context.charts
            ],
            service=EntityReference(
                id=self.context.dashboard_service.id.__root__, type="dashboardService"
            ),
        )

    def yield_dashboard_lineage_details(
        self, dashboard_details: dict
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        """
        try:
            charts = self.client.fetch_charts(dashboard_id=dashboard_details["id"]).get(
                "value"
            )
            for chart in charts:
                dataset_id = chart.get("datasetId")
                if dataset_id:
                    data_sources = self.client.fetch_data_sources(dataset_id=dataset_id)
                    for data_source in data_sources.get("value"):
                        database_name = data_source.get("connectionDetails").get(
                            "database"
                        )

                        from_fqn = fqn.build(
                            self.metadata,
                            entity_type=Database,
                            service_name=self.source_config.dbServiceName,
                            database_name=database_name,
                        )
                        from_entity = self.metadata.get_by_name(
                            entity=Database,
                            fqn=from_fqn,
                        )
                        to_fqn = fqn.build(
                            self.metadata,
                            entity_type=Dashboard,
                            service_name=self.config.serviceName,
                            dashboard_name=dashboard_details["id"],
                        )
                        to_entity = self.metadata.get_by_name(
                            entity=Dashboard,
                            fqn=to_fqn,
                        )
                        if from_entity and to_entity:
                            lineage = AddLineageRequest(
                                edge=EntitiesEdge(
                                    fromEntity=EntityReference(
                                        id=from_entity.id.__root__, type="database"
                                    ),
                                    toEntity=EntityReference(
                                        id=to_entity.id.__root__, type="dashboard"
                                    ),
                                )
                            )
                            yield lineage
        except Exception as err:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(err)

    def yield_dashboard_chart(
        self, dashboard_details: dict
    ) -> Optional[Iterable[CreateChartRequest]]:
        """Get chart method
        Args:
            dashboard_details:
        Returns:
            Iterable[Chart]
        """
        charts = self.client.fetch_charts(dashboard_id=dashboard_details["id"]).get(
            "value"
        )

        for chart in charts:
            try:
                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart["title"]
                ):
                    self.status.filter(chart["title"], "Chart Pattern not Allowed")
                    continue
                yield CreateChartRequest(
                    name=chart["id"],
                    displayName=chart["title"],
                    description="",
                    chartType=ChartType.Other.value,
                    # PBI has no hostPort property. All URL details are present in the webUrl property.
                    chartUrl=chart["embedUrl"],
                    service=EntityReference(
                        id=self.context.dashboard_service.id.__root__,
                        type="dashboardService",
                    ),
                )
                self.status.scanned(chart["title"])
            except Exception as err:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.error(err)
                self.status.failure(chart.get("id"), repr(err))
