#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Lightdash source module"""

import traceback
from typing import Any, Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.services.connections.dashboard.lightdashConnection import (
    LightdashConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.lightdash.models import (
    LightdashChart,
    LightdashDashboard,
    LightdashSpace,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import clean_uri, get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class LightdashSource(DashboardServiceSource):
    """
    Lightdash Source Class
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: LightdashConnection = config.serviceConnection.root.config
        if not isinstance(connection, LightdashConnection):
            raise InvalidSourceException(
                f"Expected LightdashConnection, but got {connection}"
            )
        return cls(config, metadata)

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.spaces: List[LightdashSpace] = []
        self.charts: List[LightdashChart] = []

    def prepare(self):
        self.spaces = self.client.get_spaces()
        self.charts = self.client.get_charts_list()
        return super().prepare()

    def get_project_name(self, dashboard_details: Any) -> Optional[str]:
        return self.client.get_project_name(dashboard_details.projectUuid)

    def get_dashboards_list(self) -> Optional[List[LightdashDashboard]]:
        """
        Get List of all dashboards
        """
        return self.client.get_dashboards_list()

    def get_dashboard_name(self, dashboard: LightdashDashboard) -> str:
        """
        Get Dashboard Name
        """
        return dashboard.name

    def get_dashboard_details(
        self, dashboard: LightdashDashboard
    ) -> LightdashDashboard:
        """
        Get Dashboard Details
        """
        return dashboard

    def yield_dashboard(
        self, dashboard_details: LightdashDashboard
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        try:
            dashboard_url = (
                f"{clean_uri(self.service_connection.hostPort)}/projects/{dashboard_details.projectUuid}"
                f"/dashboards/{dashboard_details.uuid}/view"
            )
            dashboard_charts = [chart.uuid for chart in dashboard_details.charts]

            dashboard_request = CreateDashboardRequest(
                name=EntityName(dashboard_details.uuid),
                sourceUrl=SourceUrl(dashboard_url),
                project=self.client.get_project_name(dashboard_details.projectUuid),
                displayName=dashboard_details.name,
                description=(
                    Markdown(dashboard_details.description)
                    if dashboard_details.description
                    else None
                ),
                charts=[
                    FullyQualifiedEntityName(
                        fqn.build(
                            self.metadata,
                            entity_type=Chart,
                            service_name=self.context.get().dashboard_service,
                            chart_name=chart,
                        )
                    )
                    for chart in dashboard_charts or []
                ],
                service=self.context.get().dashboard_service,
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error creating dashboard [{dashboard_details.name}]: {exc}"
            )

    def yield_dashboard_chart(
        self, dashboard_details: LightdashDashboard
    ) -> Iterable[Either[CreateChartRequest]]:
        """Get chart method

        Args:
            dashboard_details:
        Returns:
            Iterable[CreateChartRequest]
        """
        # charts = self.charts
        logger.info(
            f"Processing ChartRequests for dashboard {dashboard_details.spaceName}:{dashboard_details.name}"
        )
        for chart in dashboard_details.charts:
            try:
                chart_url = (
                    f"{clean_uri(self.service_connection.hostPort)}/projects/{dashboard_details.projectUuid}"
                    f"/saved/{chart.uuid}"
                )
                chart_type = get_standard_chart_type(chart.chartKind).value

                if filter_by_chart(self.source_config.chartFilterPattern, chart.name):
                    self.status.filter(chart.name, "Chart Pattern not allowed")
                    continue
                yield Either(
                    right=CreateChartRequest(
                        name=EntityName(chart.uuid),
                        displayName=chart.name,
                        description=(
                            Markdown(chart.description) if chart.description else None
                        ),
                        sourceUrl=SourceUrl(chart_url),
                        service=self.context.get().dashboard_service,
                        chartType=chart_type,
                    )
                )
                self.status.scanned(chart.name)
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(f"Error creating chart [{chart}]: {exc}")

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: LightdashDashboard,
        db_service_prefix: Optional[str] = None,
        _: Optional[str] = None,
    ) -> Optional[Iterable[AddLineageRequest]]:
        """Get lineage method

        Args:
            dashboard_details
        """
