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
"""Qlik Sense Source Module"""

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
from metadata.generated.schema.entity.services.connections.dashboard.qlikSenseConnection import (
    QlikSenseConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
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
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.qliksense.client import QlikSenseClient
from metadata.ingestion.source.dashboard.qliksense.models import (
    QlikDashboard,
    QlikTable,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart, filter_by_datamodel
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class QliksenseSource(DashboardServiceSource):
    """Qlik Sense Source Class"""

    config: WorkflowSource
    client: QlikSenseClient
    metadata_config: OpenMetadataConnection

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: QlikSenseConnection = config.serviceConnection.root.config
        if not isinstance(connection, QlikSenseConnection):
            raise InvalidSourceException(
                f"Expected QlikSenseConnection, but got {connection}"
            )
        return cls(config, metadata)

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.collections: List[QlikDashboard] = []
        # Data models will be cleared up for each dashboard
        self.data_models: List[QlikTable] = []

    def filter_draft_dashboard(self, dashboard: QlikDashboard) -> bool:
        # When only published(non-draft) dashboards are allowed, filter dashboard based on "published" flag from QlikDashboardMeta(qMeta)
        return (not self.source_config.includeDraftDashboard) and (
            not dashboard.qMeta.published
        )

    def get_dashboards_list(self) -> Iterable[QlikDashboard]:
        """Get List of all dashboards"""
        for dashboard in self.client.get_dashboards_list():
            if self.filter_draft_dashboard(dashboard):
                # Skip unpublished dashboards
                continue
            # create app specific websocket
            self.client.connect_websocket(dashboard.qDocId)
            # clean data models for next iteration
            self.data_models = []
            yield dashboard

    def get_dashboard_name(self, dashboard: QlikDashboard) -> str:
        """Get Dashboard Name"""
        return dashboard.qDocName

    def get_dashboard_details(self, dashboard: QlikDashboard) -> QlikDashboard:
        """Get Dashboard Details"""
        return dashboard

    def yield_dashboard(
        self, dashboard_details: QlikDashboard
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        try:
            if self.service_connection.displayUrl:
                dashboard_url = (
                    f"{clean_uri(self.service_connection.displayUrl)}/sense/app/"
                    f"{dashboard_details.qDocId}/overview"
                )
            else:
                dashboard_url = None

            dashboard_request = CreateDashboardRequest(
                name=EntityName(dashboard_details.qDocId),
                sourceUrl=SourceUrl(dashboard_url),
                displayName=dashboard_details.qDocName,
                description=(
                    Markdown(dashboard_details.qMeta.description)
                    if dashboard_details.qMeta.description
                    else None
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
                    name=dashboard_details.qDocName,
                    error=f"Error creating dashboard [{dashboard_details.qDocName}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_chart(
        self, dashboard_details: QlikDashboard
    ) -> Iterable[CreateChartRequest]:
        """Get chart method"""
        charts = self.client.get_dashboard_charts(dashboard_id=dashboard_details.qDocId)
        for chart in charts:
            try:
                if not chart.qInfo.qId:
                    continue
                if self.service_connection.displayUrl:
                    chart_url = (
                        f"{clean_uri(self.service_connection.displayUrl)}/sense/app/{dashboard_details.qDocId}"
                        f"/sheet/{chart.qInfo.qId}"
                    )
                else:
                    chart_url = None
                if chart.qMeta.title and filter_by_chart(
                    self.source_config.chartFilterPattern, chart.qMeta.title
                ):
                    self.status.filter(chart.qMeta.title, "Chart Pattern not allowed")
                    continue
                yield Either(
                    right=CreateChartRequest(
                        name=EntityName(chart.qInfo.qId),
                        displayName=chart.qMeta.title,
                        description=(
                            Markdown(chart.qMeta.description)
                            if chart.qMeta.description
                            else None
                        ),
                        chartType=ChartType.Other,
                        sourceUrl=SourceUrl(chart_url),
                        service=FullyQualifiedEntityName(
                            self.context.get().dashboard_service
                        ),
                    )
                )
            except Exception as exc:  # pylint: disable=broad-except
                yield Either(
                    left=StackTraceError(
                        name=dashboard_details.qDocName,
                        error=f"Error creating chart [{chart}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def get_column_info(self, data_source: QlikTable) -> Optional[List[Column]]:
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

    def yield_datamodel(self, _: QlikDashboard) -> Iterable[Either[DashboardDataModel]]:
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
                        name=EntityName(data_model.id),
                        displayName=data_model_name,
                        service=FullyQualifiedEntityName(
                            self.context.get().dashboard_service
                        ),
                        dataModelType=DataModelType.QlikDataModel.value,
                        serviceType=self.service_connection.type.value,
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

    def _get_datamodel(self, datamodel_id: str):
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
        datamodel: QlikTable,
        schema_name: Optional[str],
        database_name: Optional[str],
    ) -> Optional[Table]:
        """
        Get the table entity for lineage
        """
        # table.name in tableau can come as db.schema.table_name. Hence the logic to split it
        if datamodel.tableName and db_service_entity:
            try:
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=db_service_entity.name.root,
                    schema_name=schema_name,
                    table_name=datamodel.tableName,
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
        dashboard_details: QlikDashboard,
        db_service_prefix: Optional[str] = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """Get lineage method"""
        (
            prefix_service_name,
            prefix_database_name,
            prefix_schema_name,
            prefix_table_name,
        ) = self.parse_db_service_prefix(db_service_prefix)
        for datamodel in self.data_models or []:
            try:
                data_model_entity = self._get_datamodel(datamodel_id=datamodel.id)
                if data_model_entity:
                    if len(datamodel.connectorProperties.tableQualifiers) > 1:
                        (
                            database_name,
                            schema_name,
                        ) = datamodel.connectorProperties.tableQualifiers[-2:]
                    elif len(datamodel.connectorProperties.tableQualifiers) == 1:
                        schema_name = datamodel.connectorProperties.tableQualifiers[-1]
                        database_name = None
                    else:
                        schema_name, database_name = None, None

                    if (
                        prefix_table_name
                        and datamodel.tableName
                        and prefix_table_name.lower() != datamodel.tableName.lower()
                    ):
                        logger.debug(
                            f"Table {datamodel.tableName} does not match prefix {prefix_table_name}"
                        )
                        continue

                    if (
                        prefix_schema_name
                        and schema_name
                        and prefix_schema_name.lower() != schema_name.lower()
                    ):
                        logger.debug(
                            f"Schema {schema_name} does not match prefix {prefix_schema_name}"
                        )
                        continue

                    if (
                        prefix_database_name
                        and database_name
                        and prefix_database_name.lower() != database_name.lower()
                    ):
                        logger.debug(
                            f"Database {database_name} does not match prefix {prefix_database_name}"
                        )
                        continue

                    fqn_search_string = build_es_fqn_search_string(
                        database_name=prefix_database_name or database_name,
                        schema_name=prefix_schema_name or schema_name,
                        service_name=prefix_service_name or "*",
                        table_name=prefix_table_name or datamodel.tableName,
                    )
                    om_table = self.metadata.search_in_any_service(
                        entity_type=Table,
                        fqn_search_string=fqn_search_string,
                    )
                    if om_table:
                        columns_list = [col.name for col in datamodel.fields]
                        column_lineage = self._get_column_lineage(
                            om_table, data_model_entity, columns_list
                        )
                        yield self._get_add_lineage_request(
                            to_entity=data_model_entity,
                            from_entity=om_table,
                            column_lineage=column_lineage,
                        )
            except Exception as err:
                yield Either(
                    left=StackTraceError(
                        name=f"{dashboard_details.qDocName} Lineage",
                        error=(
                            "Error to yield dashboard lineage details for DB "
                            f"service name [{prefix_service_name}]: {err}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def close(self):
        self.client.close_websocket()
        return super().close()
