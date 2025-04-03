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
"""
Superset source module
"""

import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboardDataModel import DataModelType
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.dashboard.superset.mixin import SupersetSourceMixin
from metadata.ingestion.source.dashboard.superset.models import (
    ChartResult,
    DashboardResult,
    FetchChart,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_datamodel
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.helpers import (
    clean_uri,
    get_database_name_for_lineage,
    get_standard_chart_type,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SupersetAPISource(SupersetSourceMixin):
    """
    Superset API Source Class
    """

    def prepare(self):
        """
        Fetching all charts available in superset
        this step is done because fetch_total_charts api fetches all
        the required information which is not available in fetch_charts_with_id api
        """
        current_page = 0
        page_size = 25
        total_charts = self.client.fetch_total_charts()
        while current_page * page_size <= total_charts:
            charts = self.client.fetch_charts(current_page, page_size)
            current_page += 1

            for index, chart_result in enumerate(charts.result):
                self.all_charts[charts.ids[index]] = chart_result

    def get_dashboards_list(self) -> Iterable[DashboardResult]:
        """
        Get List of all dashboards
        """
        current_page = 0
        page_size = 25
        total_dashboards = self.client.fetch_total_dashboards()
        while current_page * page_size <= total_dashboards:
            dashboards = self.client.fetch_dashboards(current_page, page_size)
            current_page += 1
            for dashboard in dashboards.result:
                if (
                    not self.source_config.includeDraftDashboard
                    and not dashboard.published
                ):
                    continue
                yield dashboard

    def yield_dashboard(
        self, dashboard_details: DashboardResult
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        try:
            dashboard_request = CreateDashboardRequest(
                name=EntityName(str(dashboard_details.id)),
                displayName=dashboard_details.dashboard_title,
                sourceUrl=SourceUrl(
                    f"{clean_uri(self.service_connection.hostPort)}{dashboard_details.url}"
                ),
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
                service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name=str(dashboard_details.id) or "Dashboard",
                    error=f"Error creating dashboard [{dashboard_details.dashboard_title}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _get_datasource_fqn_for_lineage(
        self, chart_json: ChartResult, db_service_name: Optional[str]
    ):
        return (
            self._get_datasource_fqn(chart_json.datasource_id, db_service_name)
            if chart_json.datasource_id
            else None
        )

    def yield_dashboard_chart(
        self, dashboard_details: DashboardResult
    ) -> Iterable[Either[CreateChartRequest]]:
        """Method to fetch charts linked to dashboard"""
        for chart_id in self._get_charts_of_dashboard(dashboard_details):
            try:
                chart_json = self.all_charts.get(chart_id)
                if not chart_json:
                    logger.warning(
                        f"chart details for id: {chart_id} not found, skipped"
                    )
                    continue
                chart = CreateChartRequest(
                    name=EntityName(str(chart_json.id)),
                    displayName=chart_json.slice_name,
                    description=Markdown(chart_json.description)
                    if chart_json.description
                    else None,
                    chartType=get_standard_chart_type(chart_json.viz_type),
                    sourceUrl=SourceUrl(
                        f"{clean_uri(self.service_connection.hostPort)}{chart_json.url}"
                    ),
                    service=self.context.get().dashboard_service,
                )
                yield Either(right=chart)
            except Exception as exc:  # pylint: disable=broad-except
                yield Either(
                    left=StackTraceError(
                        name=str(chart_json.id),
                        error=f"Error creating chart [{chart_json.id} - {chart_json.slice_name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _get_datasource_fqn(
        self, datasource_id: str, db_service_name: Optional[str]
    ) -> Optional[str]:
        try:
            datasource_json = self.client.fetch_datasource(datasource_id)
            if datasource_json:
                database_name = None
                if db_service_name:
                    database_json = self.client.fetch_database(
                        datasource_json.result.database.id
                    )
                    default_database_name = (
                        database_json.result.parameters.database
                        if database_json.result.parameters
                        else None
                    )
                    db_service_entity = self.metadata.get_by_name(
                        entity=DatabaseService, fqn=db_service_name
                    )
                    database_name = get_database_name_for_lineage(
                        db_service_entity, default_database_name
                    )
                return build_es_fqn_search_string(
                    database_name=database_name,
                    schema_name=datasource_json.result.table_schema,
                    service_name=db_service_name or "*",
                    table_name=datasource_json.result.table_name,
                )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to fetch Datasource with id [{datasource_id}]: {err}"
            )

        return None

    def yield_datamodel(
        self, dashboard_details: DashboardResult
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        if self.source_config.includeDataModels:
            for chart_id in self._get_charts_of_dashboard(dashboard_details):
                try:
                    chart_json = self.all_charts.get(chart_id)
                    if not chart_json or not chart_json.datasource_id:
                        logger.warning(
                            f"chart details for id: {chart_id} not found, skipped"
                        )
                        continue
                    datasource_json = self.client.fetch_datasource(
                        chart_json.datasource_id
                    )
                    if filter_by_datamodel(
                        self.source_config.dataModelFilterPattern,
                        datasource_json.result.table_name,
                    ):
                        self.status.filter(
                            datasource_json.result.table_name,
                            "Data model filtered out.",
                        )
                    data_model_request = CreateDashboardDataModelRequest(
                        name=EntityName(str(datasource_json.id)),
                        displayName=datasource_json.result.table_name,
                        service=FullyQualifiedEntityName(
                            self.context.get().dashboard_service
                        ),
                        columns=self.get_column_info(datasource_json.result.columns),
                        dataModelType=DataModelType.SupersetDataModel.value,
                    )
                    yield Either(right=data_model_request)
                    self.register_record_datamodel(datamodel_request=data_model_request)
                except Exception as exc:
                    yield Either(
                        left=StackTraceError(
                            name=f"{dashboard_details.id} DataModel",
                            error=f"Error yielding Data Model [{dashboard_details.id}]: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def _get_columns_list_for_lineage(self, chart_json: FetchChart) -> List[str]:
        """
        Args:
            chart_json: FetchChart
        Returns:
            List of columns as str to generate column lineage
        """
        datasource_json = self.client.fetch_datasource(chart_json.datasource_id)
        datasource_columns = self.get_column_info(datasource_json.result.columns)
        return [col.displayName for col in datasource_columns]
