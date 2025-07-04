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
# pylint: disable=too-many-lines
import traceback
from datetime import datetime
from typing import Any, Iterable, List, Optional, Set

from requests.utils import urlparse

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.tableauConnection import (
    TableauConnection,
)
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
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
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
)
from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import (
    get_column_fqn,
    get_table_fqn_from_query_name,
)
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import (
    DashboardServiceSource,
    DashboardUsage,
)
from metadata.ingestion.source.dashboard.tableau.client import TableauClient
from metadata.ingestion.source.dashboard.tableau.models import (
    ChartUrl,
    DataSource,
    DatasourceField,
    TableAndQuery,
    TableauDashboard,
    UpstreamTable,
)
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart, filter_by_datamodel
from metadata.utils.fqn import build_es_fqn_search_string
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
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.today = datetime.now().strftime("%Y-%m-%d")

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: TableauConnection = config.serviceConnection.root.config
        if not isinstance(connection, TableauConnection):
            raise InvalidSourceException(
                f"Expected TableauConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_dashboards_list(self) -> Iterable[TableauDashboard]:
        yield from self.client.get_workbooks()

    def get_dashboard_name(self, dashboard: TableauDashboard) -> str:
        return dashboard.name

    def get_dashboard_details(self, dashboard: TableauDashboard) -> TableauDashboard:
        """
        Get Dashboard Details including the dashboard charts and datamodels
        """
        dashboard.dataModels = self.client.get_datasources(dashboard.id)
        return dashboard

    def get_owner_ref(
        self, dashboard_details: TableauDashboard
    ) -> Optional[EntityReferenceList]:
        """
        Get dashboard owner from email
        """
        try:
            if dashboard_details.owner and dashboard_details.owner.email:
                return self.metadata.get_reference_by_email(
                    dashboard_details.owner.email
                )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner data due to {err}")
        return None

    @staticmethod
    def _get_data_models_tags(data_models: List[DataSource]) -> Set[str]:
        """
        Get the tags from the data model in the upstreamDatasources
        """
        tags = set()
        try:
            for data_model in data_models:
                # tags seems to be available for upstreamDatasources only, not for dataModels
                for upstream_source in data_model.upstreamDatasources or []:
                    for tag in upstream_source.tags:
                        tags.add(tag.name)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching tags from data models: {exc}")

        return tags

    def yield_tags(
        self, dashboard_details: TableauDashboard
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        Method to yield tags related to specific dashboards
        """
        if self.source_config.includeTags:
            tags: Set = set()
            for container in [[dashboard_details], dashboard_details.charts or []]:
                for elem in container:
                    tags.update(elem.tags)
            # retrieve tags from data models
            _data_models_tags = self._get_data_models_tags(dashboard_details.dataModels)

            _all_tags = tags.union(_data_models_tags)

            yield from get_ometa_tag_and_classification(
                tags=list(_all_tags),
                classification_name=TABLEAU_TAG_CATEGORY,
                tag_description="Tableau Tag",
                classification_description="Tags associated with tableau entities",
                include_tags=self.source_config.includeTags,
            )

    def _get_datamodel_sql_query(self, data_model: DataSource) -> Optional[str]:
        """
        Method to fetch the custom sql query from the tableau datamodels
        """
        try:
            sql_queries = set()
            for table in data_model.upstreamTables or []:
                for referenced_query in table.referencedByQueries or []:
                    sql_queries.add(referenced_query.query)
            if not sql_queries:
                if query := self.client.get_custom_sql_table_queries(data_model.id):
                    sql_queries.update(query)
            return "\n\n".join(sql_queries) or None
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error processing queries for datamodel [{data_model.id}]: {exc}"
            )
        return None

    def _create_datamodel_request(
        self,
        data_model: DataSource,
        dashboard_details: TableauDashboard,
        data_model_type: DataModelType = DataModelType.TableauDataModel,
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """
        Method to prepare the CreateDashboardDataModelRequest
        """
        data_model_name = data_model.name if data_model.name else data_model.id
        if filter_by_datamodel(
            self.source_config.dataModelFilterPattern, data_model_name
        ):
            self.status.filter(data_model_name, "Data model filtered out.")
            return
        try:
            data_model_tags = data_model.tags or []
            data_model_request = CreateDashboardDataModelRequest(
                name=EntityName(data_model.id),
                displayName=data_model_name,
                description=Markdown(data_model.description)
                if data_model.description
                else None,
                service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                dataModelType=data_model_type.value,
                serviceType=DashboardServiceType.Tableau.value,
                columns=self.get_column_info(data_model),
                tags=get_tag_labels(
                    metadata=self.metadata,
                    tags=[tag.name for tag in data_model_tags],
                    classification_name=TABLEAU_TAG_CATEGORY,
                    include_tags=self.source_config.includeTags,
                ),
                sql=self._get_datamodel_sql_query(data_model=data_model),
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
                project=self.get_project_name(dashboard_details=dashboard_details),
            )
            yield Either(right=data_model_request)
            self.register_record_datamodel(datamodel_request=data_model_request)

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=data_model_name,
                    error=f"Error yielding Data Model [{data_model_name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_datamodel(
        self, dashboard_details: TableauDashboard
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """
        Method to ingest the Datasources(Published and Embedded) as DataModels from tableau
        """
        if self.source_config.includeDataModels:
            for data_model in dashboard_details.dataModels or []:
                yield from self._create_datamodel_request(
                    data_model=data_model,
                    dashboard_details=dashboard_details,
                    data_model_type=DataModelType.TableauEmbeddedDatasource,
                )
                for upstream_data_model in data_model.upstreamDatasources or []:
                    yield from self._create_datamodel_request(
                        data_model=upstream_data_model,
                        dashboard_details=dashboard_details,
                        data_model_type=DataModelType.TableauPublishedDatasource,
                    )

    def yield_dashboard(
        self, dashboard_details: TableauDashboard
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        In OM a Dashboard will be a Workbook.
        The Charts of the Dashboard will all the Views associated to it.
        The Data Models of the Dashboard will be all the Sheet associated to its.

        'self.context.dataModels' and 'self.context.charts' are created due to the 'cache_all' option defined in the
        topology. And they are cleared after processing each Dashboard because of the 'clear_cache' option.
        """
        try:
            base_url = self.get_base_url()
            dashboard_url = (
                f"{clean_uri(str(base_url))}"
                f"/#{urlparse(dashboard_details.webpageUrl).fragment}/views"
            )
            dashboard_request = CreateDashboardRequest(
                name=EntityName(dashboard_details.id),
                displayName=dashboard_details.name,
                description=Markdown(dashboard_details.description)
                if dashboard_details.description
                else None,
                project=self.get_project_name(dashboard_details=dashboard_details),
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
                dataModels=[
                    FullyQualifiedEntityName(
                        fqn.build(
                            self.metadata,
                            entity_type=DashboardDataModel,
                            service_name=self.context.get().dashboard_service,
                            data_model_name=data_model,
                        )
                    )
                    for data_model in self.context.get().dataModels or []
                ],
                tags=get_tag_labels(
                    metadata=self.metadata,
                    tags=list(dashboard_details.tags),
                    classification_name=TABLEAU_TAG_CATEGORY,
                    include_tags=self.source_config.includeTags,
                ),
                sourceUrl=SourceUrl(dashboard_url),
                service=self.context.get().dashboard_service,
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.id,
                    error=f"Error to yield dashboard for {dashboard_details}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    @staticmethod
    def _get_data_model_column_fqn(
        data_model_entity: DashboardDataModel, column: str
    ) -> Optional[List[str]]:
        """
        Get fqn of column if exist in table entity
        """
        if not data_model_entity:
            return None
        columns = []
        for tbl_column in data_model_entity.columns:
            for child_column in tbl_column.children or []:
                if column.lower() == child_column.name.root.lower():
                    columns.append(child_column.fullyQualifiedName.root)
        return columns

    # pylint: disable=arguments-differ
    def _get_column_lineage(
        self,
        upstream_table: UpstreamTable,
        table_entity: Table,
        data_model_entity: DashboardDataModel,
        upstream_col_set: Set[str],
    ) -> List[ColumnLineage]:
        """
        Get the column lineage from the fields
        """
        column_lineage = []
        try:
            for column in upstream_table.columns or []:
                if column.id in upstream_col_set:
                    from_column = get_column_fqn(
                        table_entity=table_entity, column=column.name
                    )
                    to_columns = self._get_data_model_column_fqn(
                        data_model_entity=data_model_entity,
                        column=column.id,
                    )
                    for to_column in to_columns:
                        if from_column and to_column:
                            column_lineage.append(
                                ColumnLineage(
                                    fromColumns=[from_column], toColumn=to_column
                                )
                            )
            return column_lineage
        except Exception as exc:
            logger.debug(f"Error to get column lineage: {exc}")
            logger.debug(traceback.format_exc())
        return column_lineage or None

    def yield_datamodel_dashboard_lineage(
        self,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Returns:
            Lineage request between Data Models and Dashboards
        """
        if hasattr(self.context.get(), "dataModels") and self.context.get().dataModels:
            for datamodel in self.context.get().dataModels:
                try:
                    datamodel_fqn = fqn.build(
                        metadata=self.metadata,
                        entity_type=DashboardDataModel,
                        service_name=self.context.get().dashboard_service,
                        data_model_name=datamodel,
                    )
                    datamodel_entity = self.metadata.get_by_name(
                        entity=DashboardDataModel, fqn=datamodel_fqn
                    )

                    # TableauPublishedDatasource will be skipped here and their lineage will be processed later
                    if (
                        datamodel_entity.dataModelType
                        == DataModelType.TableauPublishedDatasource
                    ):
                        continue

                    dashboard_fqn = fqn.build(
                        self.metadata,
                        entity_type=Dashboard,
                        service_name=self.context.get().dashboard_service,
                        dashboard_name=self.context.get().dashboard,
                    )
                    dashboard_entity = self.metadata.get_by_name(
                        entity=Dashboard, fqn=dashboard_fqn
                    )
                    yield self._get_add_lineage_request(
                        to_entity=dashboard_entity, from_entity=datamodel_entity
                    )
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error to yield dashboard lineage details for data model name [{str(datamodel)}]: {err}"
                    )

    def _get_table_datamodel_lineage(
        self,
        upstream_data_model: DataSource,
        datamodel: DataSource,
        db_service_name: Optional[str],
        upstream_data_model_entity: DashboardDataModel,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Method to create the lineage between table and datamodels in tableau
        """
        try:
            upstream_col_set = {
                column.id
                for field in upstream_data_model.fields
                for column in field.upstreamColumns
                if column is not None
            }
            for table in datamodel.upstreamTables or []:
                om_tables = self._get_database_tables(db_service_name, table)
                for om_table_and_query in om_tables or []:
                    column_lineage = self._get_column_lineage(
                        table,
                        om_table_and_query.table,
                        upstream_data_model_entity,
                        upstream_col_set,
                    )
                    yield self._get_add_lineage_request(
                        to_entity=upstream_data_model_entity,
                        from_entity=om_table_and_query.table,
                        column_lineage=column_lineage,
                        sql=om_table_and_query.query,
                    )
        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name="Lineage",
                    error=(
                        "Error to yield table datamodel lineage details for data model "
                        f"name [{str(datamodel)}]: {err}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )

    def _get_datamodel_child_col_lineage(
        self,
        data_model_col: Column,
        upstream_data_model_col: Column,
    ) -> Optional[List[ColumnLineage]]:
        """
        Get the lineage between children columns of the datamodels
        """
        datamodel_child_column_lineage = []
        try:
            for datamodel_child_col in data_model_col.children or []:
                for upstream_data_model_child_col in (
                    upstream_data_model_col.children or []
                ):
                    if (
                        datamodel_child_col.displayName
                        == upstream_data_model_child_col.displayName
                    ):
                        from_child_column = (
                            upstream_data_model_child_col.fullyQualifiedName.root
                        )
                        to_child_column = datamodel_child_col.fullyQualifiedName.root
                        datamodel_child_column_lineage.append(
                            ColumnLineage(
                                fromColumns=[from_child_column],
                                toColumn=to_child_column,
                            )
                        )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error to get datamodel child column lineage: {exc}")
        return datamodel_child_column_lineage or None

    def _get_datamodel_col_lineage(
        self,
        data_model_entity: DashboardDataModel,
        upstream_data_model_entity: DashboardDataModel,
    ):
        """
        Method to get the ColumnLineage list for the datamodels lineage
        """
        datamodel_column_lineage = []
        try:
            for data_model_col in data_model_entity.columns or []:
                for upstream_data_model_col in upstream_data_model_entity.columns or []:
                    if (
                        data_model_col.displayName
                        == upstream_data_model_col.displayName
                    ):
                        from_column = upstream_data_model_col.fullyQualifiedName.root
                        to_column = data_model_col.fullyQualifiedName.root
                        datamodel_column_lineage.append(
                            ColumnLineage(fromColumns=[from_column], toColumn=to_column)
                        )
                        datamodel_child_col_lineage = (
                            self._get_datamodel_child_col_lineage(
                                data_model_col=data_model_col,
                                upstream_data_model_col=upstream_data_model_col,
                            )
                        )
                        if datamodel_child_col_lineage:
                            datamodel_column_lineage.extend(datamodel_child_col_lineage)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error to get datamodel column lineage: {exc}")

        return datamodel_column_lineage or None

    # pylint: disable=too-many-locals,too-many-nested-blocks
    def _get_datamodel_table_lineage(
        self,
        datamodel: DataSource,
        data_model_entity: DashboardDataModel,
        db_service_name: Optional[str],
    ) -> Iterable[Either[AddLineageRequest]]:
        """ "
        Method to create lineage between tables<->published datasource<->embedded datasource
        """
        for upstream_data_model in datamodel.upstreamDatasources or []:
            try:
                upstream_data_model_entity = self._get_datamodel(
                    datamodel=upstream_data_model
                )
                if upstream_data_model_entity:
                    # Create [Published Datasource<->Embedded Datasource] lineage
                    yield self._get_add_lineage_request(
                        to_entity=data_model_entity,
                        from_entity=upstream_data_model_entity,
                        column_lineage=self._get_datamodel_col_lineage(
                            data_model_entity=data_model_entity,
                            upstream_data_model_entity=upstream_data_model_entity,
                        ),
                    )
                    # Create [Table<->Published Datasource] lineage
                    yield from self._get_table_datamodel_lineage(
                        upstream_data_model=upstream_data_model,
                        datamodel=datamodel,
                        db_service_name=db_service_name,
                        upstream_data_model_entity=upstream_data_model_entity,
                    )

                    # Process custom SQL queries if available
                    custom_sql_queries = self.client.get_custom_sql_table_queries(
                        datasource_id=upstream_data_model.id
                    )
                    if custom_sql_queries:
                        for query in custom_sql_queries or []:
                            db_service_entity = None
                            if db_service_name:
                                db_service_entity = self.metadata.get_by_name(
                                    entity=DatabaseService, fqn=db_service_name
                                )
                            lineage_parser = LineageParser(
                                query,
                                ConnectionTypeDialectMapper.dialect_of(
                                    db_service_entity.serviceType.value
                                )
                                if db_service_entity
                                else Dialect.ANSI,
                            )
                            for source_table in lineage_parser.source_tables or []:
                                database_schema_table = fqn.split_table_name(
                                    str(source_table)
                                )
                                database_name = database_schema_table.get("database")
                                if db_service_entity:
                                    if isinstance(
                                        db_service_entity.connection.config,
                                        BigQueryConnection,
                                    ):
                                        database_name = None
                                    database_name = get_database_name_for_lineage(
                                        db_service_entity, database_name
                                    )
                                schema_name = self.check_database_schema_name(
                                    database_schema_table.get("database_schema")
                                )
                                table_name = database_schema_table.get("table")
                                fqn_search_string = build_es_fqn_search_string(
                                    database_name=database_name,
                                    schema_name=schema_name,
                                    service_name=db_service_name or "*",
                                    table_name=table_name,
                                )
                                from_entities = self.metadata.search_in_any_service(
                                    entity_type=Table,
                                    fqn_search_string=fqn_search_string,
                                    fetch_multiple_entities=True,
                                )
                                if not from_entities:
                                    logger.debug(
                                        "No table entities found for custom SQL lineage."
                                        f"fqn_search_string={fqn_search_string}, table_name={table_name}, query={query}"
                                    )
                                for table_entity in from_entities:
                                    yield self._get_add_lineage_request(
                                        to_entity=upstream_data_model_entity,
                                        from_entity=table_entity,
                                        sql=query,
                                    )

            except Exception as err:
                yield Either(
                    left=StackTraceError(
                        name="Lineage",
                        error=(
                            "Error to yield datamodel table lineage details for DB "
                            f"service name [{db_service_name}]: {err}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: TableauDashboard,
        db_service_name: Optional[str] = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        This method creates the lineage between tables and datamodels

        Args:
            dashboard_details: Tableau Dashboard
            db_service_name: database service where look up for lineage

        Returns:
            Lineage request between Data Models and Database tables
        """
        for datamodel in dashboard_details.dataModels or []:
            try:
                data_model_entity = self._get_datamodel(datamodel=datamodel)
                if data_model_entity:
                    if datamodel.upstreamDatasources:
                        # if we have upstreamDatasources(Published Datasources), create lineage in below format
                        # Table<->Published Datasource<->Embedded Datasource
                        yield from self._get_datamodel_table_lineage(
                            datamodel=datamodel,
                            data_model_entity=data_model_entity,
                            db_service_name=db_service_name,
                        )
                    else:
                        # else we'll create lineage only using Embedded Datasources in below format
                        # Table<->Embedded Datasource
                        yield from self._get_table_datamodel_lineage(
                            upstream_data_model=datamodel,
                            datamodel=datamodel,
                            db_service_name=db_service_name,
                            upstream_data_model_entity=data_model_entity,
                        )

            except Exception as err:
                yield Either(
                    left=StackTraceError(
                        name="Lineage",
                        error=(
                            "Error to yield dashboard lineage details for DB "
                            f"service name [{db_service_name}]: {err}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_dashboard_chart(
        self, dashboard_details: TableauDashboard
    ) -> Iterable[Either[CreateChartRequest]]:
        """
        Method to fetch charts linked to dashboard
        """
        for chart in dashboard_details.charts or []:
            try:
                if filter_by_chart(self.source_config.chartFilterPattern, chart.name):
                    self.status.filter(chart.name, "Chart Pattern not allowed")
                    continue
                site_url = (
                    f"/site/{self.service_connection.siteName}/"
                    if self.service_connection.siteName
                    else ""
                )
                workbook_chart_name = ChartUrl(chart.contentUrl)

                base_url = self.get_base_url()
                chart_url = (
                    f"{clean_uri(str(base_url))}"
                    f"#{site_url}"
                    f"views/{workbook_chart_name.workbook_name}"
                    f"/{workbook_chart_name.chart_url_name}"
                )

                chart = CreateChartRequest(
                    name=EntityName(chart.id),
                    displayName=chart.name,
                    chartType=get_standard_chart_type(chart.sheetType),
                    sourceUrl=SourceUrl(chart_url),
                    tags=get_tag_labels(
                        metadata=self.metadata,
                        tags=list(chart.tags),
                        classification_name=TABLEAU_TAG_CATEGORY,
                        include_tags=self.source_config.includeTags,
                    ),
                    service=FullyQualifiedEntityName(
                        self.context.get().dashboard_service
                    ),
                )
                yield Either(right=chart)
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Chart",
                        error=f"Error to yield dashboard chart [{chart}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def close(self):
        """
        Close the connection for tableau
        """
        try:
            self.client.sign_out()
        except ConnectionError as err:
            logger.debug(f"Error closing connection - {err}")

        self.metadata.compute_percentile(Dashboard, self.today)
        self.metadata.close()

    def _get_table_entities_from_api(
        self, db_service_name: Optional[str], table: UpstreamTable
    ) -> Optional[List[TableAndQuery]]:
        """
        In case we get the table details from the Graphql APIs we process them
        """
        try:
            database_schema_table = fqn.split_table_name(table.name)
            database_name = (
                table.database.name
                if table.database and table.database.name
                else database_schema_table.get("database")
            )
            if db_service_name:
                db_service_entity = self.metadata.get_by_name(
                    entity=DatabaseService, fqn=db_service_name
                )
                if isinstance(db_service_entity.connection.config, BigQueryConnection):
                    database_name = None
                database_name = get_database_name_for_lineage(
                    db_service_entity, database_name
                )
            schema_name = (
                table.schema_
                if table.schema_
                else database_schema_table.get("database_schema")
            )
            table_name = database_schema_table.get("table")
            fqn_search_string = build_es_fqn_search_string(
                database_name=database_name,
                schema_name=schema_name,
                service_name=db_service_name or "*",
                table_name=table_name,
            )
            table_entity = self.metadata.search_in_any_service(
                entity_type=Table,
                fqn_search_string=fqn_search_string,
            )
            if table_entity:
                return [TableAndQuery(table=table_entity)]

            # fallback to fullName if schema name is not appropriate
            # TODO: We should make this a primary approach for lineage instead
            # using this strategy as a fallback.
            if not table.fullName:
                logger.debug(
                    "No table entity found for lineage using GraphQL APIs."
                    f"fqn_search_string={fqn_search_string}, table_name={table_name}"
                )
                return None
            # fullname is in the format of [database].[schema].[table] or [database].[table] or [table]
            database_query, schema_query, table_query = get_table_fqn_from_query_name(
                table.fullName.replace("[", "").replace("]", "")
            )
            if table_query:
                fqn_search_string = build_es_fqn_search_string(
                    database_name=database_query,
                    schema_name=schema_query,
                    service_name=db_service_name or "*",
                    table_name=table_query,
                )
                table_entity = self.metadata.search_in_any_service(
                    entity_type=Table,
                    fqn_search_string=fqn_search_string,
                )
                if table_entity:
                    return [TableAndQuery(table=table_entity)]
            logger.debug(
                "No table entity found for lineage using GraphQL APIs."
                f"fqn_search_string={fqn_search_string}, table_name={table_name}"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error to get tables for lineage using GraphQL Apis: {exc}")
        return None

    def _get_table_entities_from_query(
        self, db_service_name: Optional[str], table: UpstreamTable
    ) -> Optional[List[TableAndQuery]]:
        """
        In case we get the table details from the Graphql APIs we process them
        """
        tables_list = []
        try:
            for custom_sql_table in table.referencedByQueries or []:
                db_service_entity = None
                if db_service_name:
                    db_service_entity = self.metadata.get_by_name(
                        entity=DatabaseService, fqn=db_service_name
                    )
                lineage_parser = LineageParser(
                    custom_sql_table.query,
                    ConnectionTypeDialectMapper.dialect_of(
                        db_service_entity.serviceType.value
                    )
                    if db_service_entity
                    else Dialect.ANSI,
                )
                for source_table in lineage_parser.source_tables or []:
                    database_schema_table = fqn.split_table_name(str(source_table))
                    database_name = database_schema_table.get("database")
                    if db_service_entity:
                        if isinstance(
                            db_service_entity.connection.config, BigQueryConnection
                        ):
                            database_name = None
                        database_name = get_database_name_for_lineage(
                            db_service_entity, database_name
                        )
                    schema_name = self.check_database_schema_name(
                        database_schema_table.get("database_schema")
                    )
                    table_name = database_schema_table.get("table")
                    fqn_search_string = build_es_fqn_search_string(
                        database_name=database_name,
                        schema_name=schema_name,
                        service_name=db_service_name or "*",
                        table_name=table_name,
                    )
                    from_entities = self.metadata.search_in_any_service(
                        entity_type=Table,
                        fqn_search_string=fqn_search_string,
                        fetch_multiple_entities=True,
                    )
                    if not from_entities:
                        logger.debug(
                            "No table entities found for lineage using SQL Queries."
                            f"fqn_search_string={fqn_search_string}, "
                            f"table_name={table_name}, query={custom_sql_table.query}"
                        )
                    tables_list.extend(
                        [
                            TableAndQuery(table=table, query=custom_sql_table.query)
                            for table in from_entities
                            if table is not None
                        ]
                    )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error to get tables for lineage using SQL Queries: {exc}")
        return tables_list or []

    def _get_database_tables(
        self, db_service_name: Optional[str], table: UpstreamTable
    ) -> Optional[List[TableAndQuery]]:
        """
        Get the table entities for lineage
        """
        # If we get the table details from the Graphql APIs we process them directly
        if table.name:
            return self._get_table_entities_from_api(
                db_service_name=db_service_name, table=table
            )
        # Else we get the table details from the SQL queries and process them using SQL lineage parser
        if table.referencedByQueries:
            return self._get_table_entities_from_query(
                db_service_name=db_service_name, table=table
            )
        return None

    def _get_datamodel(self, datamodel: DataSource) -> Optional[DashboardDataModel]:
        """
        Get the datamodel entity for lineage
        """
        datamodel_fqn = fqn.build(
            self.metadata,
            entity_type=DashboardDataModel,
            service_name=self.context.get().dashboard_service,
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

    def get_project_name(self, dashboard_details: Any) -> Optional[str]:
        """
        Get the project / workspace / folder / collection name of the dashboard
        """
        try:
            return dashboard_details.project.name
        except Exception as exc:
            logger.info(
                f"Cannot parse project name for dashboard:{dashboard_details.id} from Tableau server"
            )
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error fetching project name for {dashboard_details.id}: {exc}"
            )
        return None

    def get_project_names(self, dashboard_details: Any) -> Optional[str]:
        """
        Get the project / workspace / folder / collection names of the dashboard
        """
        try:
            return self.client.get_project_parents_by_id(dashboard_details.project.id)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error fetching project names for {dashboard_details.id}: {exc}"
            )
        return None

    def yield_dashboard_usage(
        self, dashboard_details: TableauDashboard
    ) -> Iterable[Either[DashboardUsage]]:
        """
        Yield the usage of the dashboard
        """
        try:
            dashboard_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Dashboard,
                service_name=self.context.get().dashboard_service,
                dashboard_name=dashboard_details.id,
            )

            dashboard: Dashboard = self.metadata.get_by_name(
                entity=Dashboard,
                fqn=dashboard_fqn,
                fields=["usageSummary"],
            )

            if not dashboard:
                logger.debug(f"Dashboard {dashboard_fqn} not found, skipping usage")
                return

            current_views = dashboard_details.user_views

            if not current_views:
                logger.debug(f"No usage to report for {dashboard_details.name}")

            if not dashboard.usageSummary:
                logger.info(
                    f"Yielding fresh usage for {dashboard.fullyQualifiedName.root}"
                )
                yield Either(
                    right=DashboardUsage(
                        dashboard=dashboard,
                        usage=UsageRequest(date=self.today, count=current_views),
                    )
                )

            elif (
                str(dashboard.usageSummary.date.root) != self.today
                or not dashboard.usageSummary.dailyStats.count
            ):
                latest_usage = dashboard.usageSummary.dailyStats.count

                new_usage = current_views - latest_usage
                if new_usage < 0:
                    raise ValueError(
                        f"Wrong computation of usage difference. Got new_usage={new_usage}."
                    )

                logger.info(
                    f"Yielding new usage for {dashboard.fullyQualifiedName.root}"
                )
                yield Either(
                    right=DashboardUsage(
                        dashboard=dashboard,
                        usage=UsageRequest(
                            date=self.today, count=current_views - latest_usage
                        ),
                    )
                )

            else:
                logger.debug(
                    f"Latest usage {dashboard.usageSummary} vs. today {self.today}. Nothing to compute."
                )
                logger.info(
                    f"Usage already informed for {dashboard.fullyQualifiedName.root}"
                )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{dashboard_details.name} Usage",
                    error=f"Exception computing dashboard usage for {dashboard_details.name}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_base_url(self) -> str:
        """
        Get the proxy url for the tableau server
        """
        if self.config.serviceConnection.root.config.proxyURL:
            return str(self.config.serviceConnection.root.config.proxyURL)
        return str(self.config.serviceConnection.root.config.hostPort)
