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
"""Mstr source module"""
import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.services.connections.dashboard.mstrConnection import (
    MstrConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SourceUrl,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.mstr.models import (
    MstrDashboard,
    MstrDashboardDetails,
    MstrPage,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import clean_uri, get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MstrSource(DashboardServiceSource):
    """
    MSTR Source Class
    """

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: MstrConnection = config.serviceConnection.root.config
        if not isinstance(connection, MstrConnection):
            raise InvalidSourceException(
                f"Expected MstrConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_dashboards_list(self) -> Optional[List[MstrDashboard]]:
        """
        Get List of all dashboards
        """
        dashboards = []

        if self.client.is_project_name():
            project = self.client.get_project_by_name()
            dashboards.extend(self.client.get_dashboards_list(project.id, project.name))

        if not self.client.is_project_name():
            for project in self.client.get_projects_list():
                dashboards.extend(
                    self.client.get_dashboards_list(project.id, project.name)
                )

        return dashboards

    def get_dashboard_name(self, dashboard: MstrDashboard) -> str:
        """
        Get Dashboard Name
        """
        return dashboard.name

    def get_project_name(self, dashboard_details: MstrDashboard) -> Optional[str]:
        """
        Get dashboard project name
        """
        try:
            return dashboard_details.projectName
        except Exception as exc:
            logger.debug(
                f"Cannot get project name from dashboard [{dashboard_details.name}] - [{exc}]"
            )
        return None

    def get_dashboard_details(self, dashboard: MstrDashboard) -> MstrDashboardDetails:
        """
        Get Dashboard Details
        """
        dashboard_details = self.client.get_dashboard_details(
            dashboard.projectId, dashboard.projectName, dashboard.id
        )
        return dashboard_details

    def yield_dashboard(
        self, dashboard_details: MstrDashboardDetails
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        if dashboard_details:
            try:
                dashboard_url = (
                    f"{clean_uri(self.service_connection.hostPort)}/MicroStrategyLibrary/app/"
                    f"{dashboard_details.projectId}/{dashboard_details.id}"
                )
                dashboard_request = CreateDashboardRequest(
                    name=EntityName(dashboard_details.id),
                    displayName=dashboard_details.name,
                    sourceUrl=SourceUrl(dashboard_url),
                    project=dashboard_details.projectName,
                    charts=[
                        FullyQualifiedEntityName(
                            fqn.build(
                                self.metadata,
                                entity_type=Chart,
                                service_name=self.context.get().dashboard_service,
                                chart_name=chart,
                            )
                        )
                        for chart in self.context.get().charts or []
                    ],
                    service=self.context.get().dashboard_service,
                    owners=self.get_owner_ref(dashboard_details=dashboard_details),
                )
                yield Either(right=dashboard_request)
                self.register_record(dashboard_request=dashboard_request)
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=dashboard_details.id,
                        error=f"Error yielding dashboard for {dashboard_details}: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_dashboard_lineage_details(
        self, dashboard_details: MstrDashboardDetails, db_service_name: str
    ) -> Optional[Iterable[AddLineageRequest]]:
        """Not Implemented"""

    def yield_dashboard_chart(
        self, dashboard_details: MstrDashboardDetails
    ) -> Optional[Iterable[CreateChartRequest]]:
        """Get chart method

        Args:
            dashboard_details:
        Returns:
            Iterable[CreateChartRequest]
        """
        if dashboard_details:
            try:
                for chapter in dashboard_details.chapters:
                    for page in chapter.pages:
                        yield from self._yield_chart_from_visualization(page)

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error creating dashboard: {exc}")

    def _yield_chart_from_visualization(
        self, page: MstrPage
    ) -> Iterable[Either[CreateChartRequest]]:
        for chart in page.visualizations:
            try:
                if filter_by_chart(self.source_config.chartFilterPattern, chart.name):
                    self.status.filter(chart.name, "Chart Pattern not allowed")
                    continue

                yield Either(
                    right=CreateChartRequest(
                        name=f"{page.key}{chart.key}",
                        displayName=chart.name,
                        chartType=get_standard_chart_type(
                            chart.visualizationType
                        ).value,
                        service=self.context.get().dashboard_service,
                    )
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Chart",
                        error=f"Error creating chart [{chart}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def close(self):
        # close the api session
        self.client.close_api_session()
        self.metadata.close()
