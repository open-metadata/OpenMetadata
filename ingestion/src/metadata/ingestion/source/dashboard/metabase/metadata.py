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
"""Metabase source module"""

import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)
from metadata.generated.schema.entity.services.connections.dashboard.metabaseConnection import (
    MetabaseConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import search_table_entities
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import get_standard_chart_type, replace_special_with
from metadata.utils.logger import ingestion_logger
from metadata.ingestion.source.dashboard.metabase.models import Dashboard

logger = ingestion_logger()


class MetabaseSource(DashboardServiceSource):
    """
    Metabase Source Class
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: MetabaseConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, MetabaseConnection):
            raise InvalidSourceException(
                f"Expected MetabaseConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboards_list(self) -> Optional[List[Dashboard]]:
        """
        Get List of all dashboards
        """
        return self.client.get_dashboards_list()

    def get_dashboard_name(self, dashboard: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard["name"]

    def get_dashboard_details(self, dashboard: dict) -> dict:
        """
        Get Dashboard Details
        """
        return self.client.get_dashboard_details(dashboard["id"])

    def yield_dashboard(
        self, dashboard_details: dict
    ) -> Iterable[CreateDashboardRequest]:
        """
        Method to Get Dashboard Entity
        """
        dashboard_url = (
            f"/dashboard/{dashboard_details['id']}-"
            f"{replace_special_with(raw=dashboard_details['name'].lower(), replacement='-')}"
        )
        dashboard_request = CreateDashboardRequest(
            name=dashboard_details["id"],
            dashboardUrl=dashboard_url,
            displayName=dashboard_details.get("name"),
            description=dashboard_details.get("description", ""),
            charts=[
                fqn.build(
                    self.metadata,
                    entity_type=Chart,
                    service_name=self.context.dashboard_service.fullyQualifiedName.__root__,
                    chart_name=chart.name.__root__,
                )
                for chart in self.context.charts
            ],
            service=self.context.dashboard_service.fullyQualifiedName.__root__,
        )
        yield dashboard_request
        self.register_record(dashboard_request=dashboard_request)

    def yield_dashboard_chart(
        self, dashboard_details: dict
    ) -> Optional[Iterable[CreateChartRequest]]:
        """Get chart method

        Args:
            dashboard_details:
        Returns:
            Iterable[CreateChartRequest]
        """
        charts = dashboard_details["ordered_cards"]
        for chart in charts:
            try:
                chart_details = chart["card"]
                if "id" not in chart_details:
                    continue
                chart_url = (
                    f"/question/{chart_details['id']}-"
                    f"{replace_special_with(raw=chart_details['name'].lower(), replacement='-')}"
                )

                if "name" not in chart_details:
                    continue
                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart_details["name"]
                ):
                    self.status.filter(
                        chart_details["name"], "Chart Pattern not allowed"
                    )
                    continue
                yield CreateChartRequest(
                    name=chart_details["id"],
                    displayName=chart_details.get("name"),
                    description=chart_details.get("description", ""),
                    chartType=get_standard_chart_type(
                        str(chart_details["display"])
                    ).value,
                    chartUrl=chart_url,
                    service=self.context.dashboard_service.fullyQualifiedName.__root__,
                )
                self.status.scanned(chart_details["name"])
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(f"Error creating chart [{chart}]: {exc}")
                continue

    def yield_dashboard_lineage_details(
        self, dashboard_details: dict, db_service_name
    ) -> Optional[Iterable[AddLineageRequest]]:
        """Get lineage method

        Args:
            dashboard_details
        """
        if not db_service_name:
            return
        chart_list, dashboard_name = (
            dashboard_details["ordered_cards"],
            str(dashboard_details["id"]),
        )
        for chart in chart_list:
            try:
                chart_details = chart["card"]
                if (
                    "dataset_query" not in chart_details
                    or "type" not in chart_details["dataset_query"]
                ):
                    continue
                if chart_details["dataset_query"]["type"] == "native":
                    if not chart_details.get("database_id"):
                        continue
                    yield from self._yield_lineage_from_query(
                        chart_details=chart_details,
                        db_service_name=db_service_name,
                        dashboard_name=dashboard_name,
                    ) or []

                # TODO: this method below only gets a single table, but if the chart of type query has a join the other
                # table_ids will be ignored within a nested object
                elif chart_details["dataset_query"]["type"] == "query":
                    if not chart_details.get("table_id"):
                        continue
                    yield from self._yield_lineage_from_api(
                        chart_details=chart_details,
                        db_service_name=db_service_name,
                        dashboard_name=dashboard_name,
                    ) or []

            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.error(f"Error creating chart [{chart}]: {exc}")

    def _yield_lineage_from_query(
        self, chart_details: dict, db_service_name: str, dashboard_name: str
    ) -> Optional[AddLineageRequest]:
        database = self.client.get_database(chart_details["database_id"])

        if database is None:
            return None

        query = (
            chart_details.get("dataset_query", {}).get("native", {}).get("query", "")
        )
        lineage_parser = LineageParser(query)
        for table in lineage_parser.source_tables:
            database_schema_name, table = fqn.split(str(table))[-2:]
            database_schema_name = (
                None if database_schema_name == "<default>" else database_schema_name
            )
            database = database.get("details", {}).get("db", None)
            if database:
                from_entities = search_table_entities(
                    metadata=self.metadata,
                    database=database,
                    service_name=db_service_name,
                    database_schema=database_schema_name,
                    table=table,
                )
            else:
                from_entities = search_table_entities(
                    metadata=self.metadata,
                    service_name=db_service_name,
                    database=None,
                    database_schema=database_schema_name,
                    table=table,
                )

            to_fqn = fqn.build(
                self.metadata,
                entity_type=LineageDashboard,
                service_name=self.config.serviceName,
                dashboard_name=dashboard_name,
            )
            to_entity = self.metadata.get_by_name(
                entity=LineageDashboard,
                fqn=to_fqn,
            )

            for from_entity in from_entities:
                yield self._get_add_lineage_request(
                    to_entity=to_entity, from_entity=from_entity
                )

    def _yield_lineage_from_api(
        self, chart_details: dict, db_service_name: str, dashboard_name: str
    ) -> Optional[AddLineageRequest]:
        table = self.client.get_table(chart_details["table_id"])

        if table is None:
            return None

        database_name = table.get("db", {}).get("details", {}).get("db", None)
        if database_name:
            from_entities = search_table_entities(
                metadata=self.metadata,
                database=database_name,
                service_name=db_service_name,
                database_schema=table.get("schema"),
                table=table.get("display_name"),
            )
        else:
            from_entities = search_table_entities(
                metadata=self.metadata,
                service_name=db_service_name,
                database=None,
                database_schema=table.get("schema"),
                table=table.get("display_name"),
            )

        to_fqn = fqn.build(
            self.metadata,
            entity_type=LineageDashboard,
            service_name=self.config.serviceName,
            dashboard_name=dashboard_name,
        )
        to_entity = self.metadata.get_by_name(
            entity=LineageDashboard,
            fqn=to_fqn,
        )

        for from_entity in from_entities:
            yield self._get_add_lineage_request(
                to_entity=to_entity, from_entity=from_entity
            )
