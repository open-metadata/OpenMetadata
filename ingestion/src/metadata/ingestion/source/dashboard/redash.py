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
from typing import Dict, Iterable, List, Optional

from sql_metadata import Parser

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as Lineage_Dashboard,
)
from metadata.generated.schema.entity.services.connections.dashboard.redashConnection import (
    RedashConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.models.table_metadata import Chart as ModelChart
from metadata.ingestion.models.table_metadata import Dashboard
from metadata.ingestion.source.dashboard.dashboard_source import DashboardSourceService
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.sql_lineage import search_table_entities

logger = ingestion_logger()


@dataclass
class RedashSourceStatus(SourceStatus):
    items_scanned: int = 0
    filtered: List[str] = field(default_factory=list)

    def item_scanned_status(self) -> None:
        self.items_scanned += 1

    def item_dropped_status(self, item: str) -> None:
        self.filtered.append(item)


class RedashSource(DashboardSourceService):
    config: WorkflowSource
    metadata_config: OpenMetadataConnection
    status: RedashSourceStatus
    platform = "redash"
    dashboards_to_charts: Dict[str, List[str]]

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)
        self.status = RedashSourceStatus()
        self.dashboards_to_charts = {}

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: RedashConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, RedashConnection):
            raise InvalidSourceException(
                f"Expected RedashConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboards_list(self) -> Optional[List[dict]]:
        """
        Get List of all dashboards
        """
        dashboard_info = self.client.dashboards()
        return dashboard_info["results"]

    def get_dashboard_name(self, dashboard_details: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard_details["id"]

    def get_dashboard_details(self, dashboard: dict) -> dict:
        """
        Get Dashboard Details
        """
        return self.client.get_dashboard(dashboard["slug"])

    def get_dashboard_entity(self, dashboard_details: dict) -> Dashboard:
        """
        Method to Get Dashboard Entity
        """
        yield from self.fetch_dashboard_charts(dashboard_details)
        self.status.item_scanned_status()
        dashboard_description = ""
        for widgets in dashboard_details.get("widgets", []):
            dashboard_description = widgets.get("text")
        yield Dashboard(
            id=uuid.uuid4(),
            name=dashboard_details.get("id"),
            displayName=dashboard_details["name"],
            description=dashboard_description if dashboard_details else "",
            charts=self.dashboards_to_charts[dashboard_details.get("id")],
            usageSummary=None,
            service=EntityReference(id=self.service.id, type="dashboardService"),
            url=f"/dashboard/{dashboard_details.get('slug', '')}",
        )

    def get_lineage(
        self, dashboard_details: dict
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        In redash we do not get table, database_schema or database name but we do get query
        the lineage is being generated based on the query
        """
        for widgets in dashboard_details.get("widgets", []):
            visualization = widgets.get("visualization")
            if not visualization.get("query"):
                continue
            table_list = []
            if visualization.get("query", {}).get("query"):
                table_list = Parser(visualization["query"]["query"])
            for table in table_list.tables:
                dataabase_schema = None
                print(table)
                if "." in table:
                    dataabase_schema, table = fqn.split(table)[-2:]
                table_entities = search_table_entities(
                    metadata=self.metadata,
                    database=None,
                    service_name=self.source_config.dbServiceName,
                    database_schema=dataabase_schema,
                    table=table,
                )
                for from_entity in table_entities:
                    to_entity = self.metadata.get_by_name(
                        entity=Lineage_Dashboard,
                        fqn=fqn.build(
                            self.metadata,
                            Lineage_Dashboard,
                            service_name=self.config.serviceName,
                            dashboard_name=str(dashboard_details.get("id")),
                        ),
                    )
                    if from_entity and to_entity:
                        lineage = AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(
                                    id=from_entity.id.__root__, type="table"
                                ),
                                toEntity=EntityReference(
                                    id=to_entity.id.__root__, type="dashboard"
                                ),
                            )
                        )
                        yield lineage

    def fetch_dashboard_charts(
        self, dashboard_details: dict
    ) -> Optional[Iterable[Chart]]:
        """
        Metod to fetch charts linked to dashboard
        """
        self.dashboards_to_charts[dashboard_details.get("id")] = []
        for widgets in dashboard_details.get("widgets", []):
            visualization = widgets.get("visualization")
            self.dashboards_to_charts[dashboard_details.get("id")].append(widgets["id"])
            yield ModelChart(
                name=widgets["id"],
                displayName=visualization["query"]["name"]
                if visualization and visualization["query"]
                else "",
                chart_type=visualization["type"] if visualization else "",
                service=EntityReference(id=self.service.id, type="dashboardService"),
                url=f"/dashboard/{dashboard_details.get('slug', '')}",
                description=visualization["description"] if visualization else "",
            )

    def close(self):
        self.client.session.close()
