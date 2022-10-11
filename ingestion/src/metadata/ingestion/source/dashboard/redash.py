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
"""
Redash source module
"""

from logging.config import DictConfigurator
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
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
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.lineage.sql_lineage import search_table_entities
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.utils import fqn
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger

# Prevent sqllineage from modifying the logger config
# Disable the DictConfigurator.configure method while importing LineageRunner
configure = DictConfigurator.configure
DictConfigurator.configure = lambda _: None
from sqllineage.runner import LineageRunner  # pylint: disable=C0413

# Reverting changes after import is done
DictConfigurator.configure = configure


logger = ingestion_logger()


class RedashSource(DashboardServiceSource):
    """
    Redash Source Class
    """

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

    def yield_dashboard(
        self, dashboard_details: dict
    ) -> Iterable[CreateDashboardRequest]:
        """
        Method to Get Dashboard Entity
        """

        dashboard_description = ""
        for widgets in dashboard_details.get("widgets", []):
            dashboard_description = widgets.get("text")
        yield CreateDashboardRequest(
            name=dashboard_details.get("id"),
            displayName=dashboard_details["name"],
            description=dashboard_description,
            charts=[
                EntityReference(id=chart.id.__root__, type="chart")
                for chart in self.context.charts
            ],
            service=EntityReference(
                id=self.context.dashboard_service.id.__root__, type="dashboardService"
            ),
            dashboardUrl=f"/dashboard/{dashboard_details.get('slug', '')}",
        )
        self.status.scanned(dashboard_details["name"])

    def yield_dashboard_lineage_details(
        self, dashboard_details: dict, db_service_name: str
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
            if visualization.get("query", {}).get("query"):
                parser = LineageRunner(visualization["query"]["query"])
            for table in parser.source_tables:
                table_name = str(table)
                database_schema = None
                if "." in table:
                    database_schema, table = fqn.split(table_name)[-2:]
                table_entities = search_table_entities(
                    metadata=self.metadata,
                    database=None,
                    service_name=db_service_name,
                    database_schema=database_schema,
                    table=table_name,
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
                    yield self._get_add_lineage_request(
                        to_entity=to_entity, from_entity=from_entity
                    )

    def yield_dashboard_chart(
        self, dashboard_details: dict
    ) -> Optional[Iterable[CreateChartRequest]]:
        """
        Metod to fetch charts linked to dashboard
        """
        for widgets in dashboard_details.get("widgets", []):
            visualization = widgets.get("visualization")
            yield CreateChartRequest(
                name=widgets["id"],
                displayName=visualization["query"]["name"]
                if visualization and visualization["query"]
                else "",
                chartType=get_standard_chart_type(
                    visualization["type"] if visualization else ""
                ),
                service=EntityReference(
                    id=self.context.dashboard_service.id.__root__,
                    type="dashboardService",
                ),
                chartUrl=f"/dashboard/{dashboard_details.get('slug', '')}",
                description=visualization["description"] if visualization else "",
            )

    def close(self):
        self.client.session.close()
