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
"""Mode source module"""

import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart, ChartType
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as Lineage_Dashboard,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.modeConnection import (
    ModeConnection,
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
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.mode import client
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ModeSource(DashboardServiceSource):
    """
    Mode Source Class
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.workspace_name = config.serviceConnection.root.config.workspaceName
        self.filter_query_param = config.serviceConnection.root.config.filterQueryParam
        self.data_sources = self.client.get_all_data_sources(self.workspace_name)

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: ModeConnection = config.serviceConnection.root.config
        if not isinstance(connection, ModeConnection):
            raise InvalidSourceException(
                f"Expected ModeConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_dashboards_list(self) -> Optional[List[dict]]:
        """
        Get List of all dashboards
        """
        # If filter param field was empty, we will default to passing "all" to the API
        filter_param = "all" if not self.filter_query_param else self.filter_query_param
        return self.client.fetch_all_reports(self.workspace_name, filter_param)

    def get_dashboard_name(self, dashboard: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard.get(client.NAME)

    def get_dashboard_details(self, dashboard: dict) -> dict:
        """
        Get Dashboard Details
        """
        return dashboard

    def yield_dashboard(
        self, dashboard_details: dict
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        dashboard_path = dashboard_details[client.LINKS][client.SHARE][client.HREF]
        dashboard_url = f"{clean_uri(self.service_connection.hostPort)}{dashboard_path}"
        dashboard_request = CreateDashboardRequest(
            name=EntityName(dashboard_details.get(client.TOKEN)),
            sourceUrl=SourceUrl(dashboard_url),
            displayName=dashboard_details.get(client.NAME),
            description=Markdown(dashboard_details.get(client.DESCRIPTION))
            if dashboard_details.get(client.DESCRIPTION)
            else None,
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
            service=self.context.get().dashboard_service,
            owners=self.get_owner_ref(dashboard_details=dashboard_details),
        )
        yield Either(right=dashboard_request)
        self.register_record(dashboard_request=dashboard_request)

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: dict,
        db_service_name: Optional[str] = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """Get lineage method"""
        try:
            response_queries = self.client.get_all_queries(
                workspace_name=self.workspace_name,
                report_token=dashboard_details[client.TOKEN],
            )
            queries = response_queries[client.EMBEDDED][client.QUERIES]
            for query in queries:
                if not query.get("data_source_id"):
                    continue
                data_source = self.data_sources.get(query.get("data_source_id"))
                if not data_source:
                    continue
                lineage_parser = LineageParser(query.get("raw_query"))
                for table in lineage_parser.source_tables:
                    database_schema_name, table = fqn.split(str(table))[-2:]
                    database_schema_name = self.check_database_schema_name(
                        database_schema_name
                    )
                    fqn_search_string = build_es_fqn_search_string(
                        database_name=data_source.get(client.DATABASE),
                        schema_name=database_schema_name,
                        service_name=db_service_name or "*",
                        table_name=table,
                    )
                    from_entities = self.metadata.search_in_any_service(
                        entity_type=Table,
                        fqn_search_string=fqn_search_string,
                        fetch_multiple_entities=True,
                    )
                    for from_entity in from_entities or []:
                        to_entity = self.metadata.get_by_name(
                            entity=Lineage_Dashboard,
                            fqn=fqn.build(
                                self.metadata,
                                Lineage_Dashboard,
                                service_name=self.config.serviceName,
                                dashboard_name=dashboard_details.get(client.TOKEN),
                            ),
                        )
                        yield self._get_add_lineage_request(
                            to_entity=to_entity, from_entity=from_entity
                        )
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name="Lineage",
                    error=f"Error to yield dashboard lineage details for DB service name [{db_service_name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_chart(
        self, dashboard_details: dict
    ) -> Iterable[Either[CreateChartRequest]]:
        """Get chart method"""
        response_queries = self.client.get_all_queries(
            workspace_name=self.workspace_name,
            report_token=dashboard_details.get(client.TOKEN),
        )
        queries = response_queries[client.EMBEDDED][client.QUERIES]
        for query in queries:
            response_charts = self.client.get_all_charts(
                workspace_name=self.workspace_name,
                report_token=dashboard_details.get(client.TOKEN),
                query_token=query.get(client.TOKEN),
            )
            charts = response_charts[client.EMBEDDED][client.CHARTS]
            for chart in charts:
                chart_name = chart[client.VIEW_VEGAS].get(client.TITLE)
                try:
                    if filter_by_chart(
                        self.source_config.chartFilterPattern,
                        chart_name,
                    ):
                        self.status.filter(
                            chart_name,
                            "Chart Pattern not Allowed",
                        )
                        continue
                    chart_path = chart[client.LINKS]["report_viz_web"][client.HREF]
                    chart_url = (
                        f"{clean_uri(self.service_connection.hostPort)}{chart_path}"
                    )
                    yield Either(
                        right=CreateChartRequest(
                            name=EntityName(chart.get(client.TOKEN)),
                            displayName=chart_name,
                            chartType=ChartType.Other,
                            sourceUrl=SourceUrl(chart_url),
                            service=self.context.get().dashboard_service,
                        )
                    )
                except Exception as exc:
                    name = chart_name if chart_name else ""
                    yield Either(
                        left=StackTraceError(
                            name=name,
                            error=f"Error to yield dashboard chart [{chart}]: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )
