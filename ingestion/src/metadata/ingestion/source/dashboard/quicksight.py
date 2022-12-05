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
"""QuickSight source module"""

import traceback
from typing import Any, Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.dashboard.quickSightConnection import (
    QuickSightConnection,
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
from metadata.utils.filters import filter_by_chart
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class QuickSightSource(DashboardServiceSource):
    """
    QuickSight Source Class
    """

    config: WorkflowSource
    metadata: OpenMetadataConnection
    status: SourceStatus

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__(config, metadata_config)
        self.quicksight = self.connection.client
        self.aws_account_id = self.service_connection.awsAccountId

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: QuickSightConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, QuickSightConnection):
            raise InvalidSourceException(
                f"Expected QuickSightConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboards_list(self) -> Optional[List[dict]]:
        """
        Get List of all dashboards
        """
        dashboard_ids = [
            dashboard["DashboardId"]
            for dashboard in self.quicksight.list_dashboards(
                AwsAccountId=self.aws_account_id
            )["DashboardSummaryList"]
        ]
        dashboards = [
            self.quicksight.describe_dashboard(
                AwsAccountId=self.aws_account_id, DashboardId=dashboard_id
            )["Dashboard"]
            for dashboard_id in dashboard_ids
        ]
        return dashboards

    def get_dashboard_name(self, dashboard: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard["Name"]

    def get_dashboard_details(self, dashboard: dict) -> dict:
        """
        Get Dashboard Details
        """
        return dashboard

    def yield_dashboard(
        self, dashboard_details: dict
    ) -> Iterable[CreateDashboardRequest]:
        """
        Method to Get Dashboard Entity
        """
        dashboard_url = self.quicksight.get_dashboard_embed_url(
            AwsAccountId=self.aws_account_id,
            DashboardId=dashboard_details["DashboardId"],
            IdentityType="ANONYMOUS",
        )["EmbedUrl"]

        yield CreateDashboardRequest(
            name=dashboard_details["DashboardId"],
            dashboardUrl=dashboard_url,
            displayName=dashboard_details["Name"],
            description=dashboard_details["Version"].get("Description", ""),
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
        """Get chart method

        Args:
            dashboard_details:
        Returns:
            Iterable[CreateChartRequest]
        """
        dashboard_url = self.quicksight.get_dashboard_embed_url(
            AwsAccountId=self.aws_account_id,
            DashboardId=dashboard_details["DashboardId"],
            IdentityType="ANONYMOUS",
        )["EmbedUrl"]
        # Each dashboard is guaranteed to have at least one sheet, which represents
        # a chart in the context of QuickSight
        # https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/quicksight.html#QuickSight.Client.describe_dashboard
        charts = dashboard_details["Version"]["Sheets"]
        for chart in charts:
            try:
                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart["Name"]
                ):
                    self.status.filter(chart["Name"], "Chart Pattern not allowed")
                    continue

                yield CreateChartRequest(
                    name=chart["Name"],
                    displayName=chart["Name"],
                    description="",
                    chartType=ChartType.Other.value,
                    chartUrl=f"{dashboard_url}/sheets/{chart['SheetId']}",
                    service=EntityReference(
                        id=self.context.dashboard_service.id.__root__,
                        type="dashboardService",
                    ),
                )
                self.status.scanned(chart["Name"])
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error creating chart [{chart}]: {exc}")
                continue

    def yield_dashboard_lineage_details(
        self, dashboard_details: dict, db_service_name: str
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        """
        try:
            dataset_arns = dashboard_details["Version"]["DatasetArns"]
            dataset_ids = [
                dataset["DataSetId"]
                for dataset in self.quicksight.list_data_sets(
                    AwsAccountId=self.aws_account_id
                )
                if dataset["Arn"] in dataset_arns
            ]
            data_source_arns = set()
            for dataset_id in dataset_ids:
                for data_source in list(
                    self.quicksight.describe_data_set(
                        AwsAccountId=self.aws_account_id, DataSetId=dataset_id
                    )["Dataset"]["PhysicalTableMap"].values()
                )[0]:
                    data_source_arns.add(data_source["DataSourceArn"])
            data_sources = [
                data_source
                for data_source in self.quicksight.list_data_sources(
                    AwsAccountId=self.aws_account_id
                )["DataSources"]
                if data_source["Arn"] in data_source_arns
            ]
            for data_source in data_sources:
                database_name = data_source["Name"]
                from_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=db_service_name,
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
                    dashboard_name=dashboard_details["DashboardId"],
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
