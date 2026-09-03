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
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, cast

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart, ChartType
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
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
    SqlQuery,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.mode import client
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart, filter_by_datamodel
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

ModeRecord = dict[str, Any]


@dataclass(frozen=True)
class ModeDashboardDetails:
    """Mode report and the queries fetched for it."""

    report: ModeRecord
    queries: list[ModeRecord]


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
        self.workspace_name = config.serviceConnection.root.config.workspaceName  # pyright: ignore[reportAttributeAccessIssue]
        self.filter_query_param = config.serviceConnection.root.config.filterQueryParam  # pyright: ignore[reportAttributeAccessIssue]
        self.data_sources = cast(
            "dict[str, ModeRecord]",
            self.client.get_all_data_sources(self.workspace_name) or {},
        )

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config = WorkflowSource.model_validate(config_dict)
        connection: ModeConnection = config.serviceConnection.root.config
        if not isinstance(connection, ModeConnection):
            raise InvalidSourceException(f"Expected ModeConnection, but got {connection}")
        return cls(config, metadata)

    def get_dashboards_list(self) -> list[ModeRecord] | None:
        """
        Get List of all dashboards
        """
        # If filter param field was empty, we will default to passing "all" to the API
        filter_param = "all" if not self.filter_query_param else self.filter_query_param
        return self.client.fetch_all_reports(self.workspace_name, filter_param)

    def get_dashboard_name(self, dashboard: ModeRecord) -> str:
        """
        Get Dashboard Name
        """
        return cast("str", dashboard.get(client.NAME))

    def _dashboard_service_name(self) -> str:
        return cast("str", cast("Any", self.context.get()).dashboard_service)

    def get_dashboard_details(self, dashboard: ModeRecord) -> ModeDashboardDetails:
        """
        Get Dashboard Details
        """
        response = self.client.get_all_queries(
            workspace_name=self.workspace_name,
            report_token=cast("str", dashboard[client.TOKEN]),
        )
        queries = cast(
            "list[ModeRecord]",
            response.get(client.EMBEDDED, {}).get(client.QUERIES, []) if response else [],
        )
        return ModeDashboardDetails(report=dashboard, queries=queries or [])

    def yield_dashboard(self, dashboard_details: ModeDashboardDetails) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        report = dashboard_details.report
        dashboard_service = self._dashboard_service_name()
        charts = cast("list[str]", getattr(self.context.get(), "charts", []) or [])
        data_models = cast("list[str]", getattr(self.context.get(), "dataModels", []) or [])
        dashboard_path = cast("str", report[client.LINKS][client.SHARE][client.HREF])
        report_token = cast("str", report[client.TOKEN])
        description = cast("str | None", report.get(client.DESCRIPTION))
        dashboard_url = f"{clean_uri(self.service_connection.hostPort)}{dashboard_path}"
        dashboard_request = CreateDashboardRequest(
            name=EntityName(report_token),
            sourceUrl=SourceUrl(dashboard_url),
            displayName=cast("str | None", report.get(client.NAME)),
            description=Markdown(description) if description else None,
            charts=[
                FullyQualifiedEntityName(
                    fqn.build(
                        self.metadata,
                        entity_type=Chart,
                        service_name=dashboard_service,
                        chart_name=chart,
                    )
                )
                for chart in charts
            ],
            dataModels=(
                [
                    FullyQualifiedEntityName(
                        cast(
                            "str",
                            fqn.build(
                                self.metadata,
                                entity_type=DashboardDataModel,
                                service_name=dashboard_service,
                                data_model_name=data_model,
                            ),
                        )
                    )
                    for data_model in data_models
                ]
                if self.source_config.includeDataModels
                else None
            ),
            service=FullyQualifiedEntityName(dashboard_service),
            owners=self.get_owner_ref(dashboard_details=report),
        )
        yield Either(left=None, right=dashboard_request)
        self.register_record(dashboard_request=dashboard_request)

    def yield_datamodel(  # pyright: ignore[reportIncompatibleMethodOverride]
        self, dashboard_details: ModeDashboardDetails
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """Yield each Mode query as a dashboard data model."""
        if not self.source_config.includeDataModels:
            return

        dashboard_service = self._dashboard_service_name()
        report_token = cast("str", dashboard_details.report[client.TOKEN])
        for query in dashboard_details.queries:
            query_token = cast("str | None", query.get(client.TOKEN))
            if not query_token:
                yield Either(
                    left=StackTraceError(
                        name=cast("str | None", query.get(client.NAME)) or "",
                        error="Mode query is missing its token",
                        stackTrace="",
                    ),
                    right=None,
                )
                continue
            query_name = cast("str | None", query.get(client.NAME)) or query_token
            try:
                if filter_by_datamodel(
                    self.source_config.dataModelFilterPattern,
                    query_name,
                ):
                    self.status.filter(query_name, "Data model filtered out.")
                    continue

                raw_query = cast("str | None", query.get("raw_query"))
                datamodel_request = CreateDashboardDataModelRequest(
                    name=EntityName(self._data_model_name(report_token, query_token)),
                    displayName=query_name,
                    service=FullyQualifiedEntityName(dashboard_service),
                    serviceType=self.service_connection.type.value,
                    dataModelType=DataModelType.ModeDataModel,
                    sourceUrl=SourceUrl(
                        f"{clean_uri(self.service_connection.hostPort)}/"
                        f"{self.workspace_name}/{client.REPORTS}/{report_token}/"
                        f"{client.QUERIES}/{query_token}"
                    ),
                    sql=SqlQuery(raw_query) if raw_query else None,
                    columns=[],
                )
                yield Either(left=None, right=datamodel_request)
                self.register_record_datamodel(datamodel_request=datamodel_request)
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=query_name or "",
                        error=f"Error yielding Mode query data model [{query_name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    ),
                    right=None,
                )

    @staticmethod
    def _data_model_name(report_token: str, query_token: str) -> str:
        return f"{report_token}.{query_token}"

    # pylint: disable=too-many-locals
    def yield_dashboard_lineage_details(
        self,
        dashboard_details: ModeDashboardDetails,
        db_service_prefix: str | None = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """Get lineage method"""
        (
            prefix_service_name,
            prefix_database_name,
            prefix_schema_name,
            prefix_table_name,
        ) = self.parse_db_service_prefix(db_service_prefix)

        try:
            for query in dashboard_details.queries:
                data_source_id = cast("str | None", query.get("data_source_id"))
                if not data_source_id:
                    continue
                data_source = self.data_sources.get(data_source_id)
                if not data_source:
                    continue

                raw_query = cast("str | None", query.get("raw_query"))
                if not raw_query:
                    continue

                database_name = cast("str | None", data_source.get(client.DATABASE))
                if (
                    prefix_database_name
                    and database_name
                    and prefix_database_name.lower() != str(database_name).lower()
                ):
                    logger.debug(f"Database {database_name} does not match prefix {prefix_database_name}")
                    continue

                lineage_parser = LineageParser(
                    raw_query,
                    parser_type=self.get_query_parser_type(),
                )
                query_hash = lineage_parser.query_hash
                to_entity = self._resolve_lineage_target(
                    dashboard_details=dashboard_details,
                    query=query,
                )
                if not to_entity:
                    continue
                for table in lineage_parser.source_tables:
                    database_schema_name, table = fqn.split(str(table))[-2:]  # noqa: PLW2901
                    database_schema_name = self.check_database_schema_name(database_schema_name)

                    if prefix_table_name and table and prefix_table_name.lower() != str(table).lower():
                        logger.debug(f"[{query_hash}] Table {table} does not match prefix {prefix_table_name}")
                        continue

                    if (
                        prefix_schema_name
                        and database_schema_name
                        and prefix_schema_name.lower() != str(database_schema_name).lower()
                    ):
                        logger.debug(
                            f"[{query_hash}] Schema {database_schema_name} does not match prefix {prefix_schema_name}"
                        )
                        continue

                    fqn_search_string = build_es_fqn_search_string(
                        database_name=prefix_database_name or database_name or "*",
                        schema_name=prefix_schema_name or database_schema_name,
                        service_name=prefix_service_name or "*",
                        table_name=prefix_table_name or table,
                    )
                    from_entities = cast(
                        "list[Table] | None",
                        self.metadata.search_in_any_service(
                            entity_type=Table,
                            fqn_search_string=fqn_search_string,
                            fetch_multiple_entities=True,
                        ),
                    )

                    for from_entity in from_entities or []:
                        lineage = self._get_add_lineage_request(
                            to_entity=to_entity,
                            from_entity=from_entity,
                            sql=raw_query,
                        )
                        if lineage:
                            yield lineage
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name="Lineage",
                    error=f"Error to yield dashboard lineage details for service name [{prefix_service_name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                ),
                right=None,
            )

    def _resolve_lineage_target(
        self,
        dashboard_details: ModeDashboardDetails,
        query: ModeRecord,
    ) -> DashboardDataModel | Dashboard | None:
        """Resolve the query model, falling back to its report dashboard."""
        dashboard_service = self._dashboard_service_name()
        report_token = cast("str", dashboard_details.report[client.TOKEN])
        query_token = cast("str | None", query.get(client.TOKEN))
        datamodel_name = self._data_model_name(report_token, query_token) if query_token else None
        data_models = cast("list[str]", getattr(self.context.get(), "dataModels", None) or [])
        if self.source_config.includeDataModels and datamodel_name in data_models:
            try:
                datamodel_fqn = cast(
                    "str",
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=DashboardDataModel,
                        service_name=dashboard_service,
                        data_model_name=datamodel_name,
                    ),
                )
                datamodel = self.metadata.get_by_name(
                    entity=DashboardDataModel,
                    fqn=datamodel_fqn,
                )
                if datamodel:
                    return datamodel
            except Exception as exc:
                logger.debug(
                    "Could not resolve Mode query data model [%s]: %s",
                    datamodel_name,
                    exc,
                )

        dashboard_fqn = cast(
            "str",
            fqn.build(
                metadata=self.metadata,
                entity_type=Dashboard,
                service_name=dashboard_service,
                dashboard_name=report_token,
            ),
        )
        return self.metadata.get_by_name(entity=Dashboard, fqn=dashboard_fqn)

    def yield_dashboard_chart(self, dashboard_details: ModeDashboardDetails) -> Iterable[Either[CreateChartRequest]]:
        """Get chart method"""
        report_token = cast("str", dashboard_details.report[client.TOKEN])
        dashboard_service = self._dashboard_service_name()
        for query in dashboard_details.queries:
            query_token = cast("str | None", query.get(client.TOKEN))
            if not query_token:
                yield Either(
                    left=StackTraceError(
                        name=cast("str | None", query.get(client.NAME)) or "",
                        error="Mode query is missing its token; charts could not be fetched",
                        stackTrace="",
                    ),
                    right=None,
                )
                continue
            response_charts = self.client.get_all_charts(
                workspace_name=self.workspace_name,
                report_token=report_token,
                query_token=query_token,
            )
            charts = cast(
                "list[ModeRecord]",
                response_charts.get(client.EMBEDDED, {}).get(client.CHARTS, []) if response_charts else [],
            )
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
                    chart_url = f"{clean_uri(self.service_connection.hostPort)}{chart_path}"
                    chart_request = CreateChartRequest(
                        name=EntityName(cast("str", chart.get(client.TOKEN))),
                        displayName=chart_name,
                        chartType=ChartType.Other,
                        sourceUrl=SourceUrl(chart_url),
                        service=FullyQualifiedEntityName(dashboard_service),
                    )
                    yield Either(right=chart_request)
                    self.register_record_chart(chart_request=chart_request)
                except Exception as exc:
                    name = chart_name if chart_name else ""
                    yield Either(
                        left=StackTraceError(
                            name=name,
                            error=f"Error to yield dashboard chart [{chart}]: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )
