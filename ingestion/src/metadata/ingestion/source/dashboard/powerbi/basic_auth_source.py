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
from typing import Any, Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart, ChartType
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.source.dashboard.powerbi.mixin import PowerBISourceMixin
from metadata.ingestion.source.dashboard.powerbi.models import PowerBIDashboard
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart, filter_by_dashboard
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

POWERBI_APP_URL = "https://app.powerbi.com"


class PowerBIBasicAuthSource(PowerBISourceMixin):
    """
    PowerBI Basic Authentication Source
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)
        self.pagination_entity_per_page = min(
            100, self.service_connection.pagination_entity_per_page
        )

    def get_dashboard(self) -> Any:
        """
        Method to iterate through dashboard lists filter dashbaords & yield dashboard details
        """
        for dashboard in self.get_dashboards_list():
            try:
                dashboard_details = self.get_dashboard_details(dashboard)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Cannot extract dashboard details from {dashboard}: {exc}"
                )
                continue
            dashboard_name = self.get_dashboard_name(dashboard_details)

            if filter_by_dashboard(
                self.source_config.dashboardFilterPattern,
                dashboard_name,
            ):
                self.status.filter(
                    dashboard_name,
                    "Dashboard Fltered Out",
                )
                continue
            yield dashboard_details

    def get_dashboards_list(self) -> Optional[List[PowerBIDashboard]]:
        """
        Get List of all dashboards
        """
        return self.client.fetch_dashboards(admin=False)

    def yield_dashboard(
        self, dashboard_details: PowerBIDashboard
    ) -> Iterable[CreateDashboardRequest]:
        """
        Method to Get Dashboard Entity, Dashboard Charts & Lineage
        """
        dashboard_url = f"/groups/me/dashboards/{dashboard_details.id}"
        dashboard_request = CreateDashboardRequest(
            name=dashboard_details.id,
            # PBI has no hostPort property. Urls are built manually.
            dashboardUrl=dashboard_url,
            displayName=dashboard_details.displayName,
            description="",
            charts=[
                fqn.build(
                    self.metadata,
                    entity_type=Chart,
                    service_name=self.context.dashboard_service.fullyQualifiedName.__root__,
                    chart_name=chart.name.__root__,
                )
                for chart in self.context.charts
            ],
            service=self.context.dashboard_service.fullyQualifiedName.__root__,
        )
        yield dashboard_request
        self.register_record(dashboard_request=dashboard_request)

    def yield_dashboard_lineage_details(
        self, dashboard_details: PowerBIDashboard, db_service_name: str
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        """
        try:
            charts = self.client.fetch_charts(dashboard_id=dashboard_details.id)
            for chart in charts:
                dataset_id = chart.datasetId
                if dataset_id:
                    dataset = self.client.fetch_dataset(dataset_id)
                    if dataset:
                        for table in dataset.get("tables") or []:
                            table_name = table.get("name")

                            from_fqn = fqn.build(
                                self.metadata,
                                entity_type=Table,
                                service_name=db_service_name,
                                database_name=None,
                                schema_name=None,
                                table_name=table_name,
                            )
                            from_entity = self.metadata.get_by_name(
                                entity=Table,
                                fqn=from_fqn,
                            )
                            to_fqn = fqn.build(
                                self.metadata,
                                entity_type=Dashboard,
                                service_name=self.config.serviceName,
                                dashboard_name=dashboard_details.id,
                            )
                            to_entity = self.metadata.get_by_name(
                                entity=Dashboard,
                                fqn=to_fqn,
                            )
                            yield self._get_add_lineage_request(
                                to_entity=to_entity, from_entity=from_entity
                            )
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error to yield dashboard lineage details for DB service name [{db_service_name}]: {exc}"
            )

    def yield_dashboard_chart(
        self, dashboard_details: PowerBIDashboard
    ) -> Optional[Iterable[CreateChartRequest]]:
        """Get chart method
        Args:
            dashboard_details:
        Returns:
            Iterable[Chart]
        """
        charts = self.client.fetch_charts(dashboard_id=dashboard_details.id)

        for chart in charts or []:
            try:
                chart_title = chart.title
                chart_display_name = chart_title if chart_title else chart.id
                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart_display_name
                ):
                    self.status.filter(chart_display_name, "Chart Pattern not Allowed")
                    continue
                report_id = chart.reportId
                chart_url_postfix = (
                    f"reports/{report_id}"
                    if report_id
                    else f"dashboards/{dashboard_details.id}"
                )
                chart_url = f"/groups/me/{chart_url_postfix}"
                yield CreateChartRequest(
                    name=chart.id,
                    displayName=chart_display_name,
                    description="",
                    chartType=ChartType.Other.value,
                    # PBI has no hostPort property. All URL details are present in the webUrl property.
                    chartUrl=chart_url,
                    service=self.context.dashboard_service.fullyQualifiedName.__root__,
                )
                self.status.scanned(chart_display_name)
            except Exception as exc:
                name = chart.title
                error = f"Error creating chart [{name}]: {exc}"
                logger.debug(traceback.format_exc())
                logger.warning(error)
                self.status.failed(name, error, traceback.format_exc())
