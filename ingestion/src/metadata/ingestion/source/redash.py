#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
import sys
import uuid
from dataclasses import dataclass
from dataclasses import field
from typing import List, Iterable, Optional
from redash_toolbelt import Redash

from metadata.ingestion.api.common import IncludeFilterPattern
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.api.common import ConfigModel, Record, WorkflowContext
from metadata.ingestion.api.source import Source
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.generated.schema.entity.data.chart import Chart

from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.table_metadata import Dashboard


class RedashSourceConfig(ConfigModel):
    uri: str = "http://localhost:5000"
    api_key: str
    env: str = "DEV"
    dashboard_patterns: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    chart_patterns: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    skip_draft: bool = True
    api_page_limit: int = sys.maxsize
    service_name: str
    service_type: str


@dataclass
class RedashSourceStatus(SourceStatus):
    items_scanned: int = 0
    filtered: List[str] = field(default_factory=list)

    def item_scanned_status(self) -> None:
        self.items_scanned += 1

    def item_dropped_status(self, item: str) -> None:
        self.filtered.append(item)


class RedashSource(Source):
    config: RedashSourceConfig
    metadata_config: MetadataServerConfig
    status: RedashSourceStatus
    platform = "redash"

    def __init__(self, config: RedashSourceConfig, metadata_config: MetadataServerConfig, ctx: WorkflowContext):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = RedashSourceStatus()

        self.config.uri = self.config.uri.strip("/")

        self.client = Redash(self.config.uri, self.config.api_key)
        self.client.session.headers.update(
            {
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = RedashSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Record]:
        yield self.get_redash_charts()
        yield self.get_redash_dashboard()

    def get_redash_charts(self) -> Optional[Chart]:
        query_response = self.client.queries()
        for query_response in query_response["results"]:
            query_id = query_response["id"]
            query_name = query_response["name"]
            query_data = self.client._get(f"/api/queries/{query_id}").json()
            for visualization in query_data.get("Visualizations", []):
                chart_type = visualization.get("type", "")
                chart_description = visualization.get("description", "") if visualization.get("description", "") else ""
                yield Chart(
                    id=uuid.uuid4(),
                    name=query_id,
                    displayName=query_name,
                    chartType=chart_type,
                    service=EntityReference(id=self.service.id, type="dashboardService"),
                    description=chart_description,
                )

    def get_redash_dashboard(self) -> Dashboard:
        charts: List[Chart] = []
        dashboard_response = self.client.dashboards()
        for dashboard_response in dashboard_response["results"]:
            if dashboard_response["id"] is not None:
                if not self.config.chart_pattern.allowed(dashboard_response["id"]):
                    self.status.item_dropped_status(dashboard_response["id"])
                    continue
                self.status.item_scanned_status()
                dashboard_data = self.client.dashboard(dashboard_response["slug"])
                widgets = dashboard_data.get("widgets", [])
                dashboard_description = widgets.get("text")
                yield Dashboard(
                    id=uuid.uuid4(),
                    name=dashboard_response["id"],
                    displayName=dashboard_response["name"],
                    description=dashboard_description if dashboard_response else "",
                    charts=charts,
                    usageSummary=None,
                    service=EntityReference(id=self.service.id, type="dashboardService"),
                    href=dashboard_response["slug"]
                )

    def get_status(self) -> SourceStatus:
        return self.status
