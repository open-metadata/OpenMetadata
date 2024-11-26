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
"""Sigma source module"""

import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.sigmaConnection import (
    SigmaConnection,
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
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.sigma.models import (
    Elements,
    NodeDetails,
    Workbook,
    WorkbookDetails,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SigmaSource(DashboardServiceSource):
    """
    Sigma Source Class
    """

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SigmaConnection = config.serviceConnection.root.config
        if not isinstance(connection, SigmaConnection):
            raise InvalidSourceException(
                f"Expected SigmaConnection, but got {connection}"
            )
        return cls(config, metadata)

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.data_models: List[Elements] = []

    def get_dashboards_list(self) -> Optional[List[Workbook]]:
        """
        get list of dashboard
        """
        return self.client.get_dashboards()

    def get_dashboard_name(self, dashboard: Workbook) -> Optional[str]:
        """
        get dashboard name
        """
        return dashboard.name

    def get_dashboard_details(self, dashboard: Workbook) -> Optional[WorkbookDetails]:
        """
        get dashboard details
        """
        return self.client.get_dashboard_detail(dashboard.workbookId)

    def yield_dashboard(
        self, dashboard_details: WorkbookDetails
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        yield Dashboard Entity
        """
        try:
            dashboard_request = CreateDashboardRequest(
                name=EntityName(str(dashboard_details.workbookId)),
                displayName=dashboard_details.name,
                description=Markdown(dashboard_details.description)
                if dashboard_details.description
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
                service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                sourceUrl=SourceUrl(dashboard_details.url),
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Dashboard",
                    error=f"Error to yield dashboard for {dashboard_details}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_chart(
        self, dashboard_details: WorkbookDetails
    ) -> Iterable[Either[CreateChartRequest]]:
        """
        yield dashboard charts
        """
        charts = self.client.get_chart_details(dashboard_details.workbookId)
        for chart in charts or []:
            try:
                if filter_by_chart(self.source_config.chartFilterPattern, chart.name):
                    self.status.filter(chart.name, "Chart Pattern not allowed")
                    continue
                yield Either(
                    right=CreateChartRequest(
                        name=EntityName(str(chart.elementId)),
                        displayName=chart.name,
                        chartType=get_standard_chart_type(chart.vizualizationType),
                        service=FullyQualifiedEntityName(
                            self.context.get().dashboard_service
                        ),
                        sourceUrl=SourceUrl(dashboard_details.url),
                        description=Markdown(dashboard_details.description)
                        if dashboard_details.description
                        else None,
                    )
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Chart",
                        error=(
                            "Error to yield dashboard chart for : "
                            f"{chart.elementId} and {dashboard_details}: {exc}"
                        ),
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

    def _get_table_entity_from_node(
        self, node: NodeDetails, db_service_name: str
    ) -> Optional[Table]:
        """
        Get the table entity for lineage
        """
        if node.node_schema:
            try:
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=db_service_name,
                    schema_name=node.node_schema,
                    table_name=node.name,
                    database_name="",
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
        self, dashboard_details: WorkbookDetails, db_service_name: Optional[str]
    ):
        """
        yield dashboard lineage
        """
        if not db_service_name:
            return
        # charts and datamodels are same here as we are using charts as metadata for datamodels
        for data_model in self.data_models or []:
            try:
                data_model_entity = self._get_datamodel(
                    datamodel_id=data_model.elementId
                )
                if data_model_entity:
                    nodes = self.client.get_lineage_details(
                        dashboard_details.workbookId, data_model.elementId
                    )
                    for node in nodes:
                        table_entity = self._get_table_entity_from_node(
                            node, db_service_name
                        )
                        if table_entity and data_model.columns:
                            columns_list = data_model.columns
                            column_lineage = self._get_column_lineage(
                                table_entity, data_model_entity, columns_list
                            )
                            yield self._get_add_lineage_request(
                                to_entity=data_model_entity,
                                from_entity=table_entity,
                                column_lineage=column_lineage,
                            )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=f"{dashboard_details.name} Lineage",
                        error=(
                            "Error to yield dashboard lineage details for DB "
                            f"service name [{db_service_name}]: {exc}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def get_column_info(self, element: Elements) -> Optional[List[Column]]:
        """Build data model columns"""
        datamodel_columns = []
        for col in element.columns or []:
            try:
                datamodel_columns.append(
                    Column(
                        name=col,
                        displayName=col,
                        dataType=DataType.UNKNOWN,
                        dataTypeDisplay="Sigma Field",
                    )
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error to yield datamodel column: {exc}")
        return datamodel_columns

    def yield_datamodel(
        self, dashboard_details: WorkbookDetails
    ) -> Iterable[Either[DashboardDataModel]]:
        if self.source_config.includeDataModels:
            # we are ingesting charts/Elements as datamodels here
            self.data_models = self.client.get_chart_details(
                dashboard_details.workbookId
            )
            for data_model in self.data_models or []:
                try:
                    data_model_request = CreateDashboardDataModelRequest(
                        name=EntityName(data_model.elementId),
                        displayName=data_model.name,
                        service=FullyQualifiedEntityName(
                            self.context.get().dashboard_service
                        ),
                        dataModelType=DataModelType.SigmaDataModel.value,
                        serviceType=self.service_connection.type.value,
                        columns=self.get_column_info(data_model),
                    )
                    yield Either(right=data_model_request)
                    self.register_record_datamodel(datamodel_request=data_model_request)
                except Exception as exc:
                    yield Either(
                        left=StackTraceError(
                            name=data_model.elementId,
                            error=f"Error yielding Data Model [{data_model.elementId}]: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def get_owner_ref(
        self, dashboard_details: WorkbookDetails
    ) -> Optional[EntityReferenceList]:
        """
        Get owner from email
        """
        try:
            if dashboard_details.ownerId:
                owner = self.client.get_owner_detail(dashboard_details.ownerId)
                return self.metadata.get_reference_by_email(owner.email)
            return None
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner data due to {err}")
        return None
