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
"""QlikCloud source module"""

import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart, ChartType
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.qlikCloudConnection import (
    QlikCloudConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.qlikcloud.models import QlikApp, QlikAppList
from metadata.ingestion.source.dashboard.qliksense.models import QlikTable
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart, filter_by_datamodel
from metadata.utils.helpers import clean_uri, replace_special_with
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class QlikcloudSource(DashboardServiceSource):
    """
    QlikCloud Source Class
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config = WorkflowSource.parse_obj(config_dict)
        connection: QlikCloudConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, QlikCloudConnection):
            raise InvalidSourceException(
                f"Expected QlikCloudConnection, but got {connection}"
            )
        return cls(config, metadata)

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.collections: List[QlikAppList] = []
        self.data_models: List[QlikTable] = []

    def prepare(self):
        self.collections = self.client.get_collections_list()
        return super().prepare()

    def get_dashboards_list(self) -> Optional[List[QlikApp]]:
        """
        Get List of all apps
        """
        return self.client.get_dashboards_list()

    def get_dashboard_name(self, dashboard: QlikApp) -> str:
        """
        Get app Name
        """
        return dashboard.name

    def get_dashboard_details(self, dashboard: QlikApp) -> dict:
        """
        Get app Details
        """
        return self.client.get_dashboard_details(dashboard.app_id)

    def yield_dashboard(
        self, dashboard_details: QlikApp
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        try:
            dashboard_url = (
                f"{clean_uri(self.service_connection.hostPort)}/sense/app/{dashboard_details.id}/overview"
                f"{replace_special_with(raw=dashboard_details.name.lower(), replacement='-')}"
            )

            dashboard_request = CreateDashboardRequest(
                name=dashboard_details.id,
                sourceUrl=dashboard_url,
                displayName=dashboard_details.name,
                description=dashboard_details.description,
                project=self.context.get().project_name,
                charts=[
                    fqn.build(
                        self.metadata,
                        entity_type=Chart,
                        service_name=self.context.get().dashboard_service,
                        chart_name=chart,
                    )
                    for chart in self.context.get().charts or []
                ],
                service=self.context.get().dashboard_service,
                owner=self.get_owner_ref(dashboard_details=dashboard_details),
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.name,
                    error=f"Error creating dashboard [{dashboard_details.name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _get_datamodel(self, datamodel_id):
        datamodel_fqn = fqn.build(
            self.metadata,
            entity_type=DashboardDataModel,
            service_name=self.context.get().dashboard_service,
            data_model_name=datamodel_id,
        )
        if datamodel_fqn:
            return self.metadata.get_by_name(
                entity=DashboardDataModel,
                fqn=datamodel_fqn,
            )
        return None

    def _get_database_table(
        self,
        db_service_entity: DatabaseService,
        data_model_entity: DashboardDataModel,
    ) -> Optional[Table]:
        """
        Get the table entity for lineage
        """
        # table.name in tableau can come as db.schema.table_name. Hence the logic to split it
        if data_model_entity and db_service_entity:
            try:
                schema_name, database_name = None, None
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=db_service_entity.name.__root__,
                    schema_name=schema_name,
                    table_name=data_model_entity.displayName,
                    database_name=database_name,
                )
                if table_fqn:
                    return self.metadata.get_by_name(
                        entity=Table,
                        fqn=table_fqn,
                    )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error occured while finding table fqn: {exc}")
        return None

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: QlikApp,
        db_service_name: Optional[str],
    ) -> Iterable[Either[AddLineageRequest]]:
        """Get lineage method"""
        db_service_entity = self.metadata.get_by_name(
            entity=DatabaseService, fqn=db_service_name
        )
        for datamodel_id in self.context.get().dataModels or []:
            try:
                data_model_entity = self._get_datamodel(datamodel_id=datamodel_id)
                if data_model_entity:
                    om_table = self._get_database_table(
                        db_service_entity, data_model_entity
                    )
                    if om_table:
                        yield self._get_add_lineage_request(
                            to_entity=data_model_entity, from_entity=om_table
                        )
            except Exception as err:
                yield Either(
                    left=StackTraceError(
                        name=f"{dashboard_details.name} Lineage",
                        error=(
                            "Error to yield dashboard lineage details for DB "
                            f"service name [{db_service_name}]: {err}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_dashboard_chart(
        self, dashboard_details
    ) -> Iterable[Either[CreateChartRequest]]:
        """Get chart method"""
        charts = self.client.get_dashboard_charts(dashboard_id=dashboard_details.id)
        for chart in charts:
            try:
                chart_url = (
                    f"{clean_uri(self.service_connection.hostPort)}/sense/app/{dashboard_details.id}"
                    f"/sheet/{chart.qInfo.qId}"
                )
                if chart.qMeta.title and filter_by_chart(
                    self.source_config.chartFilterPattern, chart.qMeta.title
                ):
                    self.status.filter(chart.qMeta.title, "Chart Pattern not allowed")
                    continue
                yield Either(
                    right=CreateChartRequest(
                        name=chart.qInfo.qId,
                        displayName=chart.qMeta.title,
                        description=chart.qMeta.description,
                        chartType=ChartType.Other,
                        sourceUrl=chart_url,
                        service=self.context.get().dashboard_service,
                    )
                )
            except Exception as exc:  # pylint: disable=broad-except
                yield Either(
                    left=StackTraceError(
                        name=dashboard_details.name,
                        error=f"Error creating chart [{chart}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_datamodel(self, _: QlikApp) -> Iterable[Either[DashboardDataModel]]:
        if self.source_config.includeDataModels:
            self.data_models = self.client.get_dashboard_models()
            for data_model in self.data_models or []:
                try:
                    data_model_name = (
                        data_model.tableName if data_model.tableName else data_model.id
                    )
                    if filter_by_datamodel(
                        self.source_config.dataModelFilterPattern, data_model_name
                    ):
                        self.status.filter(data_model_name, "Data model filtered out.")
                        continue

                    data_model_request = CreateDashboardDataModelRequest(
                        name=data_model.id,
                        displayName=data_model_name,
                        service=self.context.get().dashboard_service,
                        dataModelType=DataModelType.QlikDataModel.value,
                        serviceType=DashboardServiceType.QlikCloud.value,
                        columns=self.get_column_info(data_model),
                    )
                    yield Either(right=data_model_request)
                    self.register_record_datamodel(datamodel_request=data_model_request)
                except Exception as exc:
                    name = (
                        data_model.tableName if data_model.tableName else data_model.id
                    )
                    yield Either(
                        left=StackTraceError(
                            name=name,
                            error=f"Error yielding Data Model [{name}]: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def get_column_info(self, data_source: QlikApp) -> Optional[List[Column]]:
        """Build data model columns"""
        datasource_columns = []
        for field in data_source.fields or []:
            try:
                parsed_fields = {
                    "dataTypeDisplay": "Qlik Field",
                    "dataType": DataType.UNKNOWN,
                    "name": field.id,
                    "displayName": field.name if field.name else field.id,
                }
                datasource_columns.append(Column(**parsed_fields))
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error to yield datamodel column: {exc}")
        return datasource_columns
