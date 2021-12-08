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

import logging
import os
import uuid
from dataclasses import dataclass, field
from typing import Iterable, List, Optional

import looker_sdk
from looker_sdk.error import SDKError
from looker_sdk.sdk.api31.models import Dashboard as LookerDashboard
from looker_sdk.sdk.api31.models import DashboardElement
from pydantic import SecretStr

from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import (
    ConfigModel,
    Entity,
    IncludeFilterPattern,
    WorkflowContext,
)
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.utils.helpers import get_dashboard_service_or_create

logger = logging.getLogger(__name__)


class LookerSourceConfig(ConfigModel):
    username: str
    password: SecretStr
    url: str
    platform_name: str = "looker"
    actor: str = ""
    dashboard_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    chart_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    env: str = "DEV"
    service_name: str
    service_type: str


@dataclass
class LookerDashboardSourceStatus(SourceStatus):
    dashboards_scanned: List[str] = field(default_factory=list)
    charts_scanned: List[str] = field(default_factory=list)
    filtered_dashboards: List[str] = field(default_factory=list)
    filtered_charts: List[str] = field(default_factory=list)

    def dashboards_scanned_status(self, id) -> None:
        self.dashboards_scanned.append(id)

    def charts_scanned_status(self, id) -> None:
        self.charts_scanned.append(id)

    def dashboards_dropped_status(self, model: str) -> None:
        self.filtered_dashboards.append(model)

    def charts_dropped_status(self, view: str) -> None:
        self.filtered_charts.append(view)


class LookerSource(Source[Entity]):
    config: LookerSourceConfig
    metadata_config: MetadataServerConfig
    status: LookerDashboardSourceStatus

    def __init__(
        self,
        config: LookerSourceConfig,
        metadata_config: MetadataServerConfig,
        ctx: WorkflowContext,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.client = self.looker_client()
        self.service = get_dashboard_service_or_create(
            config.service_name,
            DashboardServiceType.Looker.name,
            config.username,
            config.password.get_secret_value(),
            config.url,
            metadata_config,
        )

    def looker_client(self):
        os.environ["LOOKERSDK_CLIENT_ID"] = self.config.username
        os.environ["LOOKERSDK_CLIENT_SECRET"] = self.config.password
        os.environ["LOOKERSDK_BASE_URL"] = self.config.url
        client = looker_sdk.init31()
        client.me()
        return client

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        config = LookerSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Entity]:
        yield from self._get_looker_charts()
        yield from self._get_looker_dashboards()

    def _yield_charts(self, chart: DashboardElement):
        yield Chart(
            id=uuid.uuid4(),
            name=chart.id,
            displayName=chart.title,
            chartType=chart.type,
            service=EntityReference(id=self.service.id, type="dashboardService"),
            description=chart.subtitle_text,
        )

    def _get_looker_charts(self) -> Optional[Chart]:
        for child_dashboard in self.client.all_dashboards(fields="id"):
            fields = [
                "id",
                "title",
                "dashboard_elements",
                "dashboard_filters",
                "view_count",
            ]
            charts = self.client.dashboard_dashboard_elements(
                dashboard_id=child_dashboard.id, fields=",".join(fields)
            )
            for chart in charts:
                self._yield_charts(chart)

    def looker_dashboard(self, dashboard: LookerDashboard) -> Dashboard:
        charts: List[Chart] = []
        if dashboard.dashboard_elements is not None:
            for chart in dashboard.dashboard_elements:
                if chart.id is not None:
                    if not self.config.chart_pattern.allowed(chart.id):
                        self.status.charts_dropped_status(chart.id)
                        continue
                self.status.charts_scanned_status(chart.id)
                chart = self._yield_charts(chart)
                if chart is not None:
                    charts.append(chart)
                yield Dashboard(
                    id=uuid.uuid4(),
                    name=dashboard.id,
                    displayName=dashboard.title,
                    description=dashboard.description,
                    charts=charts,
                    usageSummary=dashboard.view_count,
                    service=EntityReference(
                        id=self.service.id, type="dashboardService"
                    ),
                    href=dashboard.slug,
                )
        else:
            logger.warning(f"No charts under Dashboard: {dashboard.title}")
            return None

    def _get_looker_dashboards(self):
        for child_dashboard in self.client.all_dashboards(fields="id"):
            if not self.config.dashboard_pattern.allowed(child_dashboard.id):
                self.status.dashboards_dropped_status(child_dashboard.id)
                continue
            self.status.dashboards_scanned_status(child_dashboard.id)
            try:
                fields = [
                    "id",
                    "title",
                    "dashboard_elements",
                    "dashboard_filters",
                    "view_count",
                ]
                dashboard = self.client.dashboard(
                    dashboard_id=child_dashboard, fields=",".join(fields)
                )
            except SDKError:
                self.status.warning(
                    child_dashboard,
                    f"Error occurred while loading dashboard {child_dashboard}.",
                )
            return self.looker_dashboard(dashboard)

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass
