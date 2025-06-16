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
"""MicroStrategy source module"""
import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services.connections.dashboard.microStrategyConnection import (
    MicroStrategyConnection,
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
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SourceUrl,
    Uuid,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import get_table_entities_from_query
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.microstrategy.helpers import (
    MicroStrategyColumnParser,
)
from metadata.ingestion.source.dashboard.microstrategy.models import (
    MstrDashboard,
    MstrDashboardDetails,
    MstrDataset,
    MstrPage,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart, filter_by_datamodel
from metadata.utils.helpers import clean_uri, get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MicrostrategySource(DashboardServiceSource):
    """
    Microstrategy Source Class
    """

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: MicroStrategyConnection = config.serviceConnection.root.config
        if not isinstance(connection, MicroStrategyConnection):
            raise InvalidSourceException(
                f"Expected MicroStrategyConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_dashboards_list(self) -> Optional[List[MstrDashboard]]:
        """
        Get List of all dashboards
        """
        dashboards = []

        if self.client.is_project_name():
            project = self.client.get_project_by_name()
            if project:
                dashboards.extend(
                    self.client.get_dashboards_list(project.id, project.name)
                )

        if not self.client.is_project_name():
            for project in self.client.get_projects_list():
                if project:
                    dashboards.extend(
                        self.client.get_dashboards_list(project.id, project.name)
                    )

        return dashboards

    def get_dashboard_name(self, dashboard: MstrDashboard) -> str:
        """
        Get Dashboard Name
        """
        return dashboard.name

    def get_project_name(self, dashboard_details: MstrDashboard) -> Optional[str]:
        """
        Get dashboard project name
        """
        try:
            return dashboard_details.projectName
        except Exception as exc:
            logger.debug(
                f"Cannot get project name from dashboard [{dashboard_details.name}] - [{exc}]"
            )
        return None

    def get_dashboard_details(self, dashboard: MstrDashboard) -> MstrDashboardDetails:
        """
        Get Dashboard Details
        """
        dashboard_details = self.client.get_dashboard_details(
            dashboard.projectId, dashboard.projectName, dashboard.id
        )
        return dashboard_details

    def yield_dashboard(
        self, dashboard_details: MstrDashboardDetails
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        if dashboard_details:
            try:
                dashboard_url = (
                    f"{clean_uri(str(self.service_connection.hostPort))}/MicroStrategyLibrary/app/"
                    f"{dashboard_details.projectId}/{dashboard_details.id}"
                )
                dashboard_request = CreateDashboardRequest(
                    name=EntityName(dashboard_details.id),
                    displayName=dashboard_details.name,
                    sourceUrl=SourceUrl(dashboard_url),
                    project=dashboard_details.projectName,
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
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=dashboard_details.id,
                        error=f"Error yielding dashboard for {dashboard_details}: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: MstrDashboardDetails,
        db_service_name: Optional[str] = None,
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between datamodel and data sources
        """
        if not db_service_name:
            return

        database_service = self.metadata.get_by_name(
            entity=DatabaseService, fqn=db_service_name
        )
        dialect = ConnectionTypeDialectMapper.dialect_of(
            database_service.serviceType.value
        )

        for dataset in dashboard_details.datasets:
            cube_sql = self.client.get_cube_sql_details(
                dashboard_details.projectId, dataset.id
            )
            if not cube_sql:
                continue

            datamodel_fqn = fqn.build(
                self.metadata,
                entity_type=DashboardDataModel,
                service_name=self.context.get().dashboard_service,
                data_model_name=dataset.id,
            )
            datamodel_entity = self.metadata.get_by_name(
                entity=DashboardDataModel, fqn=datamodel_fqn
            )

            try:
                lineage_parser = LineageParser(cube_sql, dialect=dialect)
                for table in lineage_parser.source_tables:
                    table_entities = get_table_entities_from_query(
                        metadata=self.metadata,
                        service_name=db_service_name,
                        database_name="*",
                        database_schema="*",
                        table_name=str(table),
                    )
                    if not table_entities:
                        logger.debug(f"Table not found in metadata: {str(table)}")
                        continue
                    for table_entity in table_entities or []:
                        yield Either(
                            right=AddLineageRequest(
                                edge=EntitiesEdge(
                                    fromEntity=EntityReference(
                                        id=Uuid(table_entity.id.root),
                                        type="table",
                                    ),
                                    toEntity=EntityReference(
                                        id=Uuid(datamodel_entity.id.root),
                                        type="dashboardDataModel",
                                    ),
                                    lineageDetails=LineageDetails(
                                        source=LineageSource.DashboardLineage
                                    ),
                                )
                            )
                        )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Dashboard Lineage",
                        error=f"Error to yield dashboard lineage details: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_dashboard_chart(
        self, dashboard_details: MstrDashboardDetails
    ) -> Optional[Iterable[CreateChartRequest]]:
        """Get chart method

        Args:
            dashboard_details:
        Returns:
            Iterable[CreateChartRequest]
        """
        if dashboard_details:
            try:
                for chapter in dashboard_details.chapters:
                    for page in chapter.pages:
                        yield from self._yield_chart_from_visualization(page)

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error creating dashboard: {exc}")

    def _yield_chart_from_visualization(
        self, page: MstrPage
    ) -> Iterable[Either[CreateChartRequest]]:
        for chart in page.visualizations:
            try:
                if filter_by_chart(self.source_config.chartFilterPattern, chart.name):
                    self.status.filter(chart.name, "Chart Pattern not allowed")
                    continue

                yield Either(
                    right=CreateChartRequest(
                        name=f"{page.key}{chart.key}",
                        displayName=chart.name,
                        chartType=get_standard_chart_type(
                            chart.visualizationType
                        ).value,
                        service=self.context.get().dashboard_service,
                    )
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Chart",
                        error=f"Error creating chart [{chart}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _get_column_info(self, dataset: MstrDataset) -> Optional[List[Column]]:
        """Build columns from dataset"""
        datasource_columns = []
        for available_object in dataset.availableObjects or []:
            try:
                parsed_column = {
                    "dataTypeDisplay": available_object.type.title(),
                    "dataType": DataType.UNKNOWN,
                    "name": available_object.name,
                    "displayName": available_object.name,
                }
                parsed_column_children = []
                for form in available_object.forms or []:
                    parsed_column_children.append(MicroStrategyColumnParser.parse(form))
                if parsed_column_children:
                    parsed_column["children"] = parsed_column_children

                datasource_columns.append(Column(**parsed_column))
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error to yield datamodel column: {exc}")
        return datasource_columns

    def yield_datamodel(
        self, dashboard_details: MstrDashboardDetails
    ) -> Optional[Iterable[CreateDashboardDataModelRequest]]:
        """Get datamodel method

        Args:
            dashboard_details:
        Returns:
            Iterable[CreateDashboardDataModelRequest]
        """
        try:
            if self.source_config.includeDataModels:
                for dataset in dashboard_details.datasets:
                    if filter_by_datamodel(
                        self.source_config.dataModelFilterPattern, dataset.name
                    ):
                        self.status.filter(dataset.name, "Data model filtered out.")
                        continue
                    data_model_type = DataModelType.MicroStrategyDataset.value
                    datamodel_columns = self._get_column_info(dataset)

                    data_model_request = CreateDashboardDataModelRequest(
                        name=EntityName(dataset.id),
                        displayName=dataset.name,
                        service=FullyQualifiedEntityName(
                            self.context.get().dashboard_service
                        ),
                        dataModelType=data_model_type,
                        serviceType=DashboardServiceType.MicroStrategy.value,
                        columns=datamodel_columns,
                        project=self.get_project_name(
                            dashboard_details=dashboard_details
                        ),
                    )
                    yield Either(right=data_model_request)
                    self.register_record_datamodel(datamodel_request=data_model_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=dataset.name,
                    error=f"Error yielding Data Model [{dataset.name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def close(self):
        # close the api session
        self.client.close_api_session()
        self.metadata.close()
