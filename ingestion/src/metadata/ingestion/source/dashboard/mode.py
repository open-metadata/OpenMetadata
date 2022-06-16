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
"""Mode source module"""

import traceback
from typing import Any, Iterable, List, Optional

from sqllineage.runner import LineageRunner

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as Lineage_Dashboard,
)
from metadata.generated.schema.entity.services.connections.dashboard.modeConnection import (
    ModeConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.dashboard.dashboard_source import DashboardSourceService
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import get_chart_entities_from_id
from metadata.utils.logger import ingestion_logger
from metadata.utils.mode_client import ModeConstants
from metadata.utils.sql_lineage import search_table_entities

logger = ingestion_logger()


class ModeSource(DashboardSourceService):
    """Mode entity class
    Args:
        config:
        metadata_config:
    Attributes:
        config:
        metadata_config:
        charts:
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)
        self.charts = []
        self.workspace_name = config.serviceConnection.__root__.config.workspaceName
        self.data_sources = self.client.get_all_data_sources(self.workspace_name)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        """Instantiate object
        Args:
            config_dict:
            metadata_config:
        Returns:
            ModeSource
        """
        config = WorkflowSource.parse_obj(config_dict)
        connection: ModeConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, ModeConnection):
            raise InvalidSourceException(
                f"Expected ModeConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboards_list(self) -> Optional[List[dict]]:
        """
        Get List of all dashboards
        """
        self.dashboards = self.client.fetch_all_reports(self.workspace_name)
        return self.dashboards

    def get_dashboard_name(self, dashboard_details: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard_details.get(ModeConstants.NAME.value)

    def get_dashboard_details(self, dashboard: dict) -> dict:
        """
        Get Dashboard Details
        """
        return dashboard

    def get_dashboard_entity(self, dashboard_details: dict) -> CreateDashboardRequest:
        """
        Method to Get Dashboard Entity, Dashboard Charts & Lineage
        """
        yield CreateDashboardRequest(
            name=dashboard_details.get(ModeConstants.TOKEN.value),
            dashboardUrl=dashboard_details[ModeConstants.LINKS.value][
                ModeConstants.WEB.value
            ][ModeConstants.HREF.value],
            displayName=dashboard_details.get(ModeConstants.NAME.value),
            description=dashboard_details.get(ModeConstants.DESCRIPTION.value)
            if dashboard_details.get(ModeConstants.DESCRIPTION.value)
            else "",
            charts=get_chart_entities_from_id(
                chart_ids=self.charts,
                metadata=self.metadata,
                service_name=self.config.serviceName,
            ),
            service=EntityReference(id=self.service.id, type="dashboardService"),
        )

    def get_lineage(self, dashboard_details: Any) -> Optional[AddLineageRequest]:
        """
        Get lineage between dashboard and data sources
        """
        try:
            response_queries = self.client.get_all_queries(
                workspace_name=self.workspace_name,
                report_token=dashboard_details[ModeConstants.TOKEN.value],
            )
            queries = response_queries[ModeConstants.EMBEDDED.value][
                ModeConstants.QUERIES.value
            ]
            for query in queries:
                data_source_id = query.get("data_source_id")
                if not data_source_id:
                    continue
                data_source = self.data_sources.get(data_source_id)
                if not data_source:
                    continue
                table_list = LineageRunner(query.get("raw_query"))
                for table in table_list.source_tables:
                    database_schema_name, table = fqn.split(str(table))[-2:]
                    database_schema_name = (
                        None
                        if database_schema_name == "<default>"
                        else database_schema_name
                    )
                    from_entities = search_table_entities(
                        metadata=self.metadata,
                        database=data_source.get(ModeConstants.DATABASE.value),
                        service_name=self.source_config.dbServiceName,
                        database_schema=database_schema_name,
                        table=table,
                    )
                    for from_entity in from_entities:
                        to_entity = self.metadata.get_by_name(
                            entity=Lineage_Dashboard,
                            fqn=fqn.build(
                                self.metadata,
                                Lineage_Dashboard,
                                service_name=self.config.serviceName,
                                dashboard_name=dashboard_details.get(
                                    ModeConstants.TOKEN.value
                                ),
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
        except Exception as err:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(err)

    def fetch_dashboard_charts(
        self, dashboard_details: dict
    ) -> Iterable[CreateChartRequest]:
        """Get chart method
        Args:
            dashboard_details:
        Returns:
            Iterable[Chart]
        """
        self.charts = []
        response_queries = self.client.get_all_queries(
            workspace_name=self.workspace_name,
            report_token=dashboard_details.get(ModeConstants.TOKEN.value),
        )
        queries = response_queries[ModeConstants.EMBEDDED.value][
            ModeConstants.QUERIES.value
        ]
        for query in queries:
            response_charts = self.client.get_all_charts(
                workspace_name=self.workspace_name,
                report_token=dashboard_details.get(ModeConstants.TOKEN.value),
                query_token=query.get(ModeConstants.TOKEN.value),
            )
            charts = response_charts[ModeConstants.EMBEDDED.value][
                ModeConstants.CHARTS.value
            ]
            for chart in charts:
                try:
                    if filter_by_chart(
                        self.source_config.chartFilterPattern,
                        chart[ModeConstants.VIEW_VEGAS.value][
                            ModeConstants.TITLE.value
                        ],
                    ):
                        self.status.filter(
                            chart[ModeConstants.VIEW_VEGAS][ModeConstants.TITLE],
                            "Chart Pattern not Allowed",
                        )
                        continue
                    chart_url = (
                        f"{ModeConstants.BASE_URL.value}"
                        f"{chart[ModeConstants.LINKS.value]['report_viz_web'][ModeConstants.HREF.value]}"
                    )
                    yield CreateChartRequest(
                        name=chart.get(ModeConstants.TOKEN.value),
                        displayName=chart[ModeConstants.VIEW_VEGAS.value][
                            ModeConstants.TITLE.value
                        ],
                        description="",
                        chartType=ChartType.Other.value,
                        chartUrl=chart_url,
                        service=EntityReference(
                            id=self.service.id, type="dashboardService"
                        ),
                    )
                    self.charts.append(chart.get(ModeConstants.TOKEN.value))
                    self.status.scanned(
                        chart[ModeConstants.VIEW_VEGAS.value][ModeConstants.TITLE.value]
                    )
                except Exception as err:  # pylint: disable=broad-except
                    logger.debug(traceback.format_exc())
                    logger.error(err)
                    self.status.failure(
                        chart[ModeConstants.VIEW_VEGAS.value][
                            ModeConstants.TITLE.value
                        ],
                        repr(err),
                    )
