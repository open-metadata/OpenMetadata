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

import uuid
from dataclasses import dataclass, field
from typing import Dict, Iterable, List

import requests
from redash_toolbelt import Redash

from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import ConfigModel, Entity, WorkflowContext
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.table_metadata import Chart as ModelChart
from metadata.ingestion.models.table_metadata import Dashboard
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.utils.helpers import get_dashboard_service_or_create


class RedashSourceConfig(ConfigModel):
    uri: str = "http://localhost:5000"
    username: str = ""
    api_key: str
    service_name: str
    service_type: str = "Redash"


@dataclass
class RedashSourceStatus(SourceStatus):
    items_scanned: int = 0
    filtered: List[str] = field(default_factory=list)

    def item_scanned_status(self) -> None:
        self.items_scanned += 1

    def item_dropped_status(self, item: str) -> None:
        self.filtered.append(item)


class RedashSource(Source[Entity]):
    config: RedashSourceConfig
    metadata_config: MetadataServerConfig
    status: RedashSourceStatus
    platform = "redash"
    dashboards_to_charts: Dict[str, List[str]]

    def __init__(
        self,
        config: RedashSourceConfig,
        metadata_config: MetadataServerConfig,
        ctx: WorkflowContext,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = RedashSourceStatus()
        self.client = Redash(self.config.uri, self.config.api_key)
        self.service = get_dashboard_service_or_create(
            config.service_name,
            DashboardServiceType.Redash.name,
            config.username,
            config.api_key,
            config.uri,
            metadata_config,
        )
        self.dashboards_to_charts = {}

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        config = RedashSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Entity]:
        yield from self.get_redash_charts()
        dashboard_info = self.client.dashboards()
        yield from self.get_redash_dashboard_charts(dashboard_info)
        yield from self.get_redash_dashboard(dashboard_info)

    def get_redash_charts(self) -> Chart:
        query_info = self.client.queries()
        for query_info in query_info["results"]:
            query_id = query_info["id"]
            query_name = query_info["name"]
            query_data = requests.get(
                f"{self.config.uri}/api/queries/{query_id}"
            ).json()
            for visualization in query_data.get("Visualizations", []):
                chart_type = visualization.get("type", "")
                chart_description = (
                    visualization.get("description", "")
                    if visualization.get("description", "")
                    else ""
                )
                yield Chart(
                    id=uuid.uuid4(),
                    name=query_id,
                    displayName=query_name,
                    chartType=chart_type,
                    service=EntityReference(
                        id=self.service.id, type="dashboardService"
                    ),
                    description=chart_description,
                )

    def get_redash_dashboard_charts(self, dashboard_info) -> Chart:
        for dashboard_info in dashboard_info["results"]:
            dashboard_id = dashboard_info["id"]
            if dashboard_id is not None:
                dashboard_data = self.client.dashboard(dashboard_info["slug"])
                self.dashboards_to_charts[dashboard_id] = []
                for widgets in dashboard_data.get("widgets", []):
                    visualization = widgets.get("visualization")
                    self.dashboards_to_charts[dashboard_id].append(widgets["id"])
                    yield ModelChart(
                        name=widgets["id"],
                        displayName=visualization["query"]["name"],
                        chart_type=visualization["type"],
                        service=EntityReference(
                            id=self.service.id, type="dashboardService"
                        ),
                        url=(
                            f"{self.config.uri}/dashboard/{dashboard_data.get('slug', '')}"
                        ),
                        description=visualization["description"],
                    )

    def get_redash_dashboard(self, dashboard_info) -> Dashboard:
        for dashboard_info in dashboard_info["results"]:
            dashboard_id = dashboard_info["id"]
            if dashboard_id is not None:
                self.status.item_scanned_status()
                dashboard_data = self.client.dashboard(dashboard_info["slug"])
                dashboard_url = (
                    f"{self.config.uri}/dashboard/{dashboard_data.get('slug', '')}"
                )
                for widgets in dashboard_data.get("widgets", []):
                    dashboard_description = widgets.get("text")
                yield Dashboard(
                    id=uuid.uuid4(),
                    name=dashboard_id,
                    displayName=dashboard_info["name"],
                    description=dashboard_description if dashboard_info else "",
                    charts=self.dashboards_to_charts[dashboard_id],
                    usageSummary=None,
                    service=EntityReference(
                        id=self.service.id, type="dashboardService"
                    ),
                    url=dashboard_url,
                )

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        self.client.session.close()
