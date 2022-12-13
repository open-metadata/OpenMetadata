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
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
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
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart, filter_by_dashboard
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

POWERBI_APP_URL = "https://app.powerbi.com"


class PowerbiSource(DashboardServiceSource):
    """
    PowerBi Source Class
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection
    status: SourceStatus

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):

        super().__init__(config, metadata_config)
        self.workspace_data = {}

    def prepare(self):
        # fetch all the workspace ids
        workspaces = self.client.fetch_all_workspaces()
        if workspaces:
            workspace_id_list = [workspace.get("id") for workspace in workspaces]

            # Start the scan of the available workspaces for dashboard metadata
            workspace_scan = self.client.initiate_workspace_scan(workspace_id_list)
            workspace_scan_id = workspace_scan.get("id")

            # Keep polling the scan status endpoint to check if scan is succeeded
            workspace_scan_status = self.client.wait_for_scan_complete(
                scan_id=workspace_scan_id
            )
            if workspace_scan_status:
                response = self.client.fetch_workspace_scan_result(
                    scan_id=workspace_scan_id
                )
                self.workspace_data = response.get("workspaces")
            else:
                logger.error("Error in fetching dashboards and charts")
        else:
            logger.error("Unable to fetch any Powerbi workspaces")
        return super().prepare()

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: PowerBIConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, PowerBIConnection):
            raise InvalidSourceException(
                f"Expected PowerBIConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboard(self) -> Any:
        """
        Method to iterate through dashboard lists filter dashbaords & yield dashboard details
        """
        for workspace in self.workspace_data:
            self.context.workspace = workspace
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

    def get_dashboards_list(self) -> Optional[List[dict]]:
        """
        Get List of all dashboards
        """
        return self.context.workspace.get("dashboards")

    def get_dashboard_name(self, dashboard: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard["displayName"]

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
        dashboard_url = (
            f"/groups/{self.context.workspace.get('id')}"
            f"/dashboards/{dashboard_details.get('id')}"
        )
        yield CreateDashboardRequest(
            name=dashboard_details["id"],
            # PBI has no hostPort property. Urls are built manually.
            dashboardUrl=dashboard_url,
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
        self, dashboard_details: dict, db_service_name: str
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        """
        try:
            charts = dashboard_details.get("tiles")
            for chart in charts:
                dataset_id = chart.get("datasetId")
                if dataset_id:
                    dataset = self.fetch_dataset_from_workspace(dataset_id)
                    if dataset:
                        for table in dataset.get("tables"):
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
                                dashboard_name=dashboard_details["id"],
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
        self, dashboard_details: dict
    ) -> Optional[Iterable[CreateChartRequest]]:
        """Get chart method
        Args:
            dashboard_details:
        Returns:
            Iterable[Chart]
        """
        charts = dashboard_details.get("tiles")
        for chart in charts:
            try:
                chart_title = chart.get("title")
                chart_display_name = chart_title if chart_title else chart.get("id")
                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart_display_name
                ):
                    self.status.filter(chart_display_name, "Chart Pattern not Allowed")
                    continue
                report_id = chart.get("reportId")
                chart_url_postfix = (
                    f"reports/{report_id}"
                    if report_id
                    else f"dashboards/{dashboard_details.get('id')}"
                )
                chart_url = (
                    f"/groups/{self.context.workspace.get('id')}/{chart_url_postfix}"
                )
                yield CreateChartRequest(
                    name=chart["id"],
                    displayName=chart_display_name,
                    description="",
                    chartType=ChartType.Other.value,
                    # PBI has no hostPort property. All URL details are present in the webUrl property.
                    chartUrl=chart_url,
                    service=EntityReference(
                        id=self.context.dashboard_service.id.__root__,
                        type="dashboardService",
                    ),
                )
                self.status.scanned(chart_display_name)
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(f"Error creating chart [{chart}]: {exc}")
                self.status.failure(chart.get("id"), repr(exc))

    def fetch_dataset_from_workspace(self, dataset_id: str) -> Optional[dict]:
        """
        Method to search the dataset using id in the workspace dict
        """

        dataset_data = next(
            (
                dataset
                for dataset in self.context.workspace.get("datasets") or []
                if dataset["id"] == dataset_id
            ),
            None,
        )
        return dataset_data
