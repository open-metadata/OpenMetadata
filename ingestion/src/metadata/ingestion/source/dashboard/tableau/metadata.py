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
Tableau source module
"""
import traceback
from typing import Iterable, List, Optional, Set

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
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.tableauConnection import (
    TableauConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.tableau.client import TableauClient
from metadata.ingestion.source.dashboard.tableau.models import (
    ChartUrl,
    DataSource,
    DatasourceField,
    TableauDashboard,
    TableauTag,
    UpstreamTable,
)
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart, filter_by_datamodel
from metadata.utils.helpers import (
    clean_uri,
    get_database_name_for_lineage,
    get_standard_chart_type,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

logger = ingestion_logger()

TABLEAU_TAG_CATEGORY = "TableauTags"


class TableauSource(DashboardServiceSource):
    """
    Tableau Source Class
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection
    client: TableauClient

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)
        self.workbooks: List[
            TableauDashboard
        ] = []  # We will populate this in `prepare`
        self.tags: Set[TableauTag] = set()

    def prepare(self):
        """
        Restructure the API response to
        """
        try:
            # get workbooks which are considered Dashboards in OM
            self.workbooks = self.client.get_workbooks()

            # get views which are considered charts in OM
            charts = self.client.get_charts()

            # get datasources which are considered as datamodels in OM
            data_models = self.client.get_datasources()

            # add all the charts (views) and datasources from the API to each workbook
            for workbook in self.workbooks:
                workbook.charts = [
                    chart for chart in charts if chart.workbook.id == workbook.id
                ]

                for data_model in data_models or []:
                    if data_model.workbook and data_model.workbook.luid == workbook.id:
                        workbook.dataModels.append(data_model)

            # collect all the tags from charts and workbooks before yielding final entities
            if self.source_config.includeTags:
                for container in [self.workbooks, charts]:
                    for elem in container:
                        self.tags.update(elem.tags)

        except Exception:
            logger.debug(traceback.format_exc())
            logger.error("Error in fetching the Tableau Workbook metadata")

        return super().prepare()

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: TableauConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, TableauConnection):
            raise InvalidSourceException(
                f"Expected TableauConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboards_list(self) -> Optional[List[TableauDashboard]]:
        """
        Get List of all dashboards
        """
        return self.workbooks

    def get_dashboard_name(self, dashboard: TableauDashboard) -> str:
        """
        Get Dashboard Name
        """
        return dashboard.name

    def get_dashboard_details(self, dashboard: TableauDashboard) -> TableauDashboard:
        """
        Get Dashboard Details. Returning the identity here as we prepare everything
        during the `prepare` stage
        """
        return dashboard

    def get_owner_details(
        self, dashboard_details: TableauDashboard
    ) -> Optional[EntityReference]:
        """Get dashboard owner

        Args:
            dashboard_details:
        Returns:
            Optional[EntityReference]
        """
        if dashboard_details.owner and dashboard_details.owner.email:
            user = self.metadata.get_user_by_email(dashboard_details.owner.email)
            if user:
                return EntityReference(id=user.id.__root__, type="user")
        return None

    def yield_tag(self, *_, **__) -> OMetaTagAndClassification:
        """
        Fetch Dashboard Tags
        """
        yield from get_ometa_tag_and_classification(
            tags=[tag.label for tag in self.tags],
            classification_name=TABLEAU_TAG_CATEGORY,
            tag_description="Tableau Tag",
            classification_desciption="Tags associated with tableau entities",
            include_tags=self.source_config.includeTags,
        )

    def yield_datamodel(
        self, dashboard_details: TableauDashboard
    ) -> Iterable[CreateDashboardDataModelRequest]:
        if self.source_config.includeDataModels:
            for data_model in dashboard_details.dataModels or []:
                data_model_name = data_model.name if data_model.name else data_model.id
                if filter_by_datamodel(
                    self.source_config.dataModelFilterPattern, data_model_name
                ):
                    self.status.filter(data_model_name, "Data model filtered out.")
                    continue
                try:
                    data_model_request = CreateDashboardDataModelRequest(
                        name=data_model.id,
                        displayName=data_model_name,
                        service=self.context.dashboard_service.fullyQualifiedName.__root__,
                        dataModelType=DataModelType.TableauDataModel.value,
                        serviceType=DashboardServiceType.Tableau.value,
                        columns=self.get_column_info(data_model),
                    )
                    yield data_model_request
                    self.status.scanned(
                        f"Data Model Scanned: {data_model_request.displayName}"
                    )
                except Exception as exc:
                    error_msg = f"Error yielding Data Model [{data_model_name}]: {exc}"
                    self.status.failed(
                        name=data_model_name,
                        error=error_msg,
                        stack_trace=traceback.format_exc(),
                    )
                    logger.error(error_msg)
                    logger.debug(traceback.format_exc())

    def yield_dashboard(
        self, dashboard_details: TableauDashboard
    ) -> Iterable[CreateDashboardRequest]:
        """
        Method to Get Dashboard Entity
        In OM a Dashboard will be a Workbook.
        The Charts of the Dashboard will all the Views associated to it.
        The Data Models of the Dashboard will be all the Sheet associated to its.

        'self.context.dataModels' and 'self.context.charts' are created due to the 'cache_all' option defined in the
        topology. And they are cleared after processing each Dashboard because of the 'clear_cache' option.
        """
        try:
            dashboard_request = CreateDashboardRequest(
                name=dashboard_details.id,
                displayName=dashboard_details.name,
                description=dashboard_details.description,
                project=dashboard_details.project.name,
                charts=[
                    fqn.build(
                        self.metadata,
                        entity_type=Chart,
                        service_name=self.context.dashboard_service.fullyQualifiedName.__root__,
                        chart_name=chart.name.__root__,
                    )
                    for chart in self.context.charts
                ],
                dataModels=[
                    fqn.build(
                        self.metadata,
                        entity_type=DashboardDataModel,
                        service_name=self.context.dashboard_service.fullyQualifiedName.__root__,
                        data_model_name=data_model.name.__root__,
                    )
                    for data_model in self.context.dataModels or []
                ],
                tags=get_tag_labels(
                    metadata=self.metadata,
                    tags=[tag.label for tag in dashboard_details.tags],
                    classification_name=TABLEAU_TAG_CATEGORY,
                    include_tags=self.source_config.includeTags,
                ),
                sourceUrl=dashboard_details.webpageUrl,
                service=self.context.dashboard_service.fullyQualifiedName.__root__,
            )
            yield dashboard_request
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error to yield dashboard for {dashboard_details}: {exc}")

    def yield_dashboard_lineage(
        self, dashboard_details: TableauDashboard
    ) -> Optional[Iterable[AddLineageRequest]]:
        yield from self.yield_datamodel_dashboard_lineage() or []

        for db_service_name in self.source_config.dbServiceNames or []:
            yield from self.yield_dashboard_lineage_details(
                dashboard_details, db_service_name
            ) or []

    def yield_datamodel_dashboard_lineage(
        self,
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Returns:
            Lineage request between Data Models and Dashboards
        """
        for datamodel in self.context.dataModels or []:
            try:
                yield self._get_add_lineage_request(
                    to_entity=self.context.dashboard, from_entity=datamodel
                )
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error to yield dashboard lineage details for data model name [{datamodel.name}]: {err}"
                )

    def yield_dashboard_lineage_details(
        self, dashboard_details: TableauDashboard, db_service_name: str
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        In Tableau, we get the lineage between data models and data sources.

        We build a DatabaseTable set from the sheets (data models) columns, and create a lineage request with an OM
        table if we can find it.

        Args:
            dashboard_details: Tableau Dashboard
            db_service_name: database service where look up for lineage

        Returns:
            Lineage request between Data Models and Database table
        """
        db_service_entity = self.metadata.get_by_name(
            entity=DatabaseService, fqn=db_service_name
        )
        for datamodel in dashboard_details.dataModels or []:
            try:
                data_model_entity = self._get_datamodel(datamodel=datamodel)
                if data_model_entity:
                    for table in datamodel.upstreamTables or []:
                        om_table = self._get_database_table(db_service_entity, table)
                        if om_table:
                            yield self._get_add_lineage_request(
                                to_entity=data_model_entity, from_entity=om_table
                            )
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error to yield dashboard lineage details for DB service name [{db_service_name}]: {err}"
                )

    def yield_dashboard_chart(
        self, dashboard_details: TableauDashboard
    ) -> Optional[Iterable[CreateChartRequest]]:
        """
        Method to fetch charts linked to dashboard
        """
        for chart in dashboard_details.charts or []:
            try:
                if filter_by_chart(self.source_config.chartFilterPattern, chart.name):
                    self.status.filter(chart.name, "Chart Pattern not allowed")
                    continue
                site_url = (
                    f"/site/{self.service_connection.siteUrl}/"
                    if self.service_connection.siteUrl
                    else ""
                )
                workbook_chart_name = ChartUrl(chart.contentUrl)

                chart_url = (
                    f"{clean_uri(self.service_connection.hostPort)}/"
                    f"#{site_url}"
                    f"views/{workbook_chart_name.workbook_name}"
                    f"/{workbook_chart_name.chart_url_name}"
                )

                yield CreateChartRequest(
                    name=chart.id,
                    displayName=chart.name,
                    chartType=get_standard_chart_type(chart.sheetType),
                    sourceUrl=chart_url,
                    tags=get_tag_labels(
                        metadata=self.metadata,
                        tags=[tag.label for tag in chart.tags],
                        classification_name=TABLEAU_TAG_CATEGORY,
                        include_tags=self.source_config.includeTags,
                    ),
                    service=self.context.dashboard_service.fullyQualifiedName.__root__,
                )
                self.status.scanned(chart.name)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error to yield dashboard chart [{chart}]: {exc}")

    def close(self):
        """
        Close the connection for tableau
        """
        try:
            self.client.sign_out()
        except ConnectionError as err:
            logger.debug(f"Error closing connection - {err}")

    def _get_database_table(
        self, db_service_entity: DatabaseService, table: UpstreamTable
    ) -> Optional[Table]:
        """
        Get the table entity for lineage
        """
        # table.name in tableau can come as db.schema.table_name. Hence the logic to split it
        if table.name:
            database_schema_table = fqn.split_table_name(table.name)
            database_name = (
                table.database.name
                if table.database and table.database.name
                else database_schema_table.get("database")
            )
            database_name = get_database_name_for_lineage(
                db_service_entity, database_name
            )
            schema_name = (
                table.schema_
                if table.schema_
                else database_schema_table.get("database_schema")
            )
            table_name = database_schema_table.get("table")
            table_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=db_service_entity.name.__root__,
                schema_name=schema_name,
                table_name=table_name,
                database_name=database_name,
            )
            if table_fqn:
                return self.metadata.get_by_name(
                    entity=Table,
                    fqn=table_fqn,
                )
        return None

    def _get_datamodel(self, datamodel: DataSource) -> Optional[DashboardDataModel]:
        """
        Get the datamodel entity for lineage
        """
        datamodel_fqn = fqn.build(
            self.metadata,
            entity_type=DashboardDataModel,
            service_name=self.context.dashboard_service.fullyQualifiedName.__root__,
            data_model_name=datamodel.id,
        )
        if datamodel_fqn:
            return self.metadata.get_by_name(
                entity=DashboardDataModel,
                fqn=datamodel_fqn,
            )
        return None

    def get_child_columns(self, field: DatasourceField) -> List[Column]:
        """
        Extract the child columns from the fields
        """
        columns = []
        for column in field.upstreamColumns or []:
            try:
                if column:
                    parsed_column = {
                        "dataTypeDisplay": column.remoteType
                        if column.remoteType
                        else DataType.UNKNOWN.value,
                        "dataType": ColumnTypeParser.get_column_type(
                            column.remoteType if column.remoteType else None
                        ),
                        "name": column.id,
                        "displayName": column.name if column.name else column.id,
                    }
                    if column.remoteType and column.remoteType == DataType.ARRAY.value:
                        parsed_column["arrayDataType"] = DataType.UNKNOWN
                    columns.append(Column(**parsed_column))
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error to process datamodel nested column: {exc}")
        return columns

    def get_column_info(self, data_source: DataSource) -> Optional[List[Column]]:
        """
        Args:
            data_source: DataSource
        Returns:
            Columns details for Data Model
        """
        datasource_columns = []
        for field in data_source.fields or []:
            try:
                parsed_fields = {
                    "dataTypeDisplay": "Tableau Field",
                    "dataType": DataType.RECORD,
                    "name": field.id,
                    "displayName": field.name if field.name else field.id,
                    "description": field.description,
                }
                child_columns = self.get_child_columns(field=field)
                if child_columns:
                    parsed_fields["children"] = child_columns
                datasource_columns.append(Column(**parsed_fields))
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error to yield datamodel column: {exc}")
        return datasource_columns
