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
from typing import Iterable, List

import looker_sdk
from pydantic import SecretStr

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
from metadata.ingestion.models.table_metadata import Chart, Dashboard
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
            service_name=config.service_name,
            dashboard_service_type=DashboardServiceType.Looker.name,
            username=config.username,
            password=config.password.get_secret_value(),
            dashboard_url=config.url,
            metadata_config=metadata_config,
        )

    def check_env(self, env_key):
        if os.environ.get(env_key):
            return True
        return None

    def looker_client(self):
        try:
            if not self.check_env("LOOKERSDK_CLIENT_ID"):
                os.environ["LOOKERSDK_CLIENT_ID"] = self.config.username
            if not self.check_env("LOOKERSDK_CLIENT_SECRET"):
                os.environ[
                    "LOOKERSDK_CLIENT_SECRET"
                ] = self.config.password.get_secret_value()
            if not self.check_env("LOOKERSDK_BASE_URL"):
                os.environ["LOOKERSDK_BASE_URL"] = self.config.url
            client = looker_sdk.init31()
            client.me()
            return client
        except Exception as err:
            logger.error(f"ERROR: {repr(err)}")

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
        yield from self._get_looker_dashboards()

    def _get_dashboard_elements(self, dashboard_elements):
        if not self.config.dashboard_pattern.included(dashboard_elements.id):
            self.status.charts_dropped_status(dashboard_elements.id)
            return None
        self.status.charts_scanned_status(dashboard_elements.id)
        return Chart(
            id=uuid.uuid4(),
            name=dashboard_elements.id,
            displayName=dashboard_elements.id,
            description=dashboard_elements.title,
            chart_type=dashboard_elements.type,
            url=self.config.url,
            service=EntityReference(id=self.service.id, type="dashboardService"),
        )

    def _get_looker_dashboards(self):
        all_dashboards = self.client.all_dashboards(fields="id")
        for child_dashboard in all_dashboards:
            try:
                if not self.config.dashboard_pattern.included(child_dashboard.id):
                    self.status.dashboards_dropped_status(child_dashboard.id)
                    continue
                fields = [
                    "id",
                    "title",
                    "dashboard_elements",
                    "dashboard_filters",
                    "view_count",
                ]
                dashboard = self.client.dashboard(
                    dashboard_id=child_dashboard.id, fields=",".join(fields)
                )
                charts = []
                for iter_chart in dashboard.dashboard_elements:
                    chart = self._get_dashboard_elements(iter_chart)
                    if chart:
                        charts.append(chart)
                yield Dashboard(
                    id=uuid.uuid4(),
                    name=dashboard.id,
                    displayName=dashboard.title,
                    description="temp",
                    charts=charts,
                    url=self.config.url,
                    service=EntityReference(
                        id=self.service.id, type="dashboardService"
                    ),
                )
                self.status.dashboards_scanned_status(child_dashboard.id)
            except Exception as err:
                logger.error(repr(err))

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass
