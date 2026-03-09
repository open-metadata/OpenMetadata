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
"""
SSRS source module
"""
import traceback
from typing import Any, Dict, Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart, ChartType
from metadata.generated.schema.entity.services.connections.dashboard.ssrsConnection import (
    SsrsConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
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
    Markdown,
    SourceUrl,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.ssrs.models import SsrsReport
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SsrsSource(DashboardServiceSource):
    config: WorkflowSource
    metadata_config: OpenMetadataConnection

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> "SsrsSource":
        config = WorkflowSource.model_validate(config_dict)
        connection: SsrsConnection = config.serviceConnection.root.config
        if not isinstance(connection, SsrsConnection):
            raise InvalidSourceException(
                f"Expected SsrsConnection, but got {connection}"
            )
        return cls(config, metadata)

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.folder_path_map: Dict[str, str] = {}

    def prepare(self):
        folders = self.client.get_folders()
        self.folder_path_map = {folder.path: folder.name for folder in folders}
        return super().prepare()

    def get_dashboards_list(self) -> Optional[List[SsrsReport]]:
        reports = self.client.get_reports()
        return [r for r in reports if not r.hidden]

    def get_dashboard_name(self, dashboard: SsrsReport) -> str:
        return dashboard.name

    def get_dashboard_details(self, dashboard: SsrsReport) -> Optional[SsrsReport]:
        return dashboard

    def get_project_name(self, dashboard_details: Any) -> Optional[str]:
        try:
            if isinstance(dashboard_details, SsrsReport) and dashboard_details.path:
                parts = dashboard_details.path.rsplit("/", 1)
                if len(parts) > 1 and parts[0]:
                    return self.folder_path_map.get(parts[0])
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Error fetching project name: %s", exc)
        return None

    def yield_dashboard(
        self, dashboard_details: SsrsReport
    ) -> Iterable[Either[CreateDashboardRequest]]:
        try:
            dashboard_url = (
                f"{clean_uri(self.service_connection.hostPort)}"
                f"/report{dashboard_details.path}"
            )
            dashboard_request = CreateDashboardRequest(
                name=EntityName(dashboard_details.id),
                sourceUrl=SourceUrl(dashboard_url),
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
                    for chart in self.context.get().charts or []
                ],
                project=self.context.get().project_name,
                service=self.context.get().dashboard_service,
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.name,
                    error=f"Error creating dashboard [{dashboard_details.name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_chart(
        self, dashboard_details: SsrsReport
    ) -> Iterable[Either[CreateChartRequest]]:
        try:
            chart_name = dashboard_details.name
            if filter_by_chart(self.source_config.chartFilterPattern, chart_name):
                self.status.filter(chart_name, "Chart Pattern not allowed")
                return
            chart_url = (
                f"{clean_uri(self.service_connection.hostPort)}"
                f"/report{dashboard_details.path}"
            )
            yield Either(
                right=CreateChartRequest(
                    name=EntityName(f"{dashboard_details.id}_chart"),
                    displayName=chart_name,
                    description=(
                        Markdown(dashboard_details.description)
                        if dashboard_details.description
                        else None
                    ),
                    chartType=ChartType.Other.value,
                    sourceUrl=SourceUrl(chart_url),
                    service=self.context.get().dashboard_service,
                )
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.name,
                    error=f"Error creating chart [{dashboard_details.name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: SsrsReport,
        db_service_prefix: Optional[str] = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        return

    def close(self):
        self.client.close()
        return super().close()
