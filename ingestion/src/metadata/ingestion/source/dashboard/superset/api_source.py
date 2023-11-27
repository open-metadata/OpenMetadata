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
Superset source module
"""

import traceback
from typing import Iterable, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboardDataModel import DataModelType
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.source.dashboard.superset.mixin import SupersetSourceMixin
from metadata.ingestion.source.dashboard.superset.models import (
    ChartResult,
    DashboardResult,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_datamodel
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
                yield dashboard

    def yield_dashboard(
        self, dashboard_details: DashboardResult
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        try:
            dashboard_request = CreateDashboardRequest(
                name=dashboard_details.id,
                displayName=dashboard_details.dashboard_title,
                sourceUrl=f"{clean_uri(self.service_connection.hostPort)}{dashboard_details.url}",
                charts=[
                    fqn.build(
                        self.metadata,
                        entity_type=Chart,
                        service_name=self.context.dashboard_service,
                        chart_name=chart,
                    )
                    for chart in self.context.charts
                ],
                service=self.context.dashboard_service,
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.id or "Dashboard",
                    error=f"Error creating dashboard [{dashboard_details.dashboard_title}]: {exc}",
                    stack_trace=traceback.format_exc(),
                )
            )

    def _get_datasource_fqn_for_lineage(
        self, chart_json: ChartResult, db_service_entity: DatabaseService
    ):
        return (
            self._get_datasource_fqn(chart_json.datasource_id, db_service_entity)
            if chart_json.datasource_id
            else None
        )

    def yield_dashboard_chart(
        self, dashboard_details: DashboardResult
    ) -> Iterable[Either[CreateChartRequest]]:
        """Method to fetch charts linked to dashboard"""
        for chart_id in self._get_charts_of_dashboard(dashboard_details):
            chart_json = self.all_charts.get(chart_id)
            if not chart_json:
                logger.warning(f"chart details for id: {chart_id} not found, skipped")
                continue
            chart = CreateChartRequest(
                name=chart_json.id,
                displayName=chart_json.slice_name,
                description=chart_json.description,
                chartType=get_standard_chart_type(chart_json.viz_type),
                sourceUrl=f"{clean_uri(self.service_connection.hostPort)}{chart_json.url}",
                service=self.context.dashboard_service,
            )
            yield Either(right=chart)

    def _get_datasource_fqn(
        self, datasource_id: str, db_service_entity: DatabaseService
    ) -> Optional[str]:
        try:
            datasource_json = self.client.fetch_datasource(datasource_id)
            if datasource_json:
                database_json = self.client.fetch_database(
                    datasource_json.result.database.id
                )
                default_database_name = (
                    database_json.result.parameters.database
                    if database_json.result.parameters
                    else None
                )

                database_name = get_database_name_for_lineage(
                    db_service_entity, default_database_name
                )

                if database_json:
                    dataset_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        table_name=datasource_json.result.table_name,
                        schema_name=datasource_json.result.table_schema,
                        database_name=database_name,
                        service_name=db_service_entity.name.__root__,
                    )
                return dataset_fqn
        except KeyError as err:
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
                    if not chart_json:
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
                        name=datasource_json.id,
                        displayName=datasource_json.result.table_name,
                        service=self.context.dashboard_service,
                        columns=self.get_column_info(datasource_json.result.columns),
                        dataModelType=DataModelType.SupersetDataModel.value,
                    )
                    yield Either(right=data_model_request)
                except Exception as exc:
                    yield Either(
                        left=StackTraceError(
                            name=f"{dashboard_details.id} DataModel",
                            error=f"Error yielding Data Model [{dashboard_details.id}]: {exc}",
                            stack_trace=traceback.format_exc(),
                        )
                    )
