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
"""Sigma source module"""

import traceback
from collections.abc import Iterable
from functools import cached_property

from metadata.domain.table_reference import TableReference
from metadata.entity_resolution.table_binding import TableLookup, UnsupportedTableReferenceError
from metadata.entity_resolution.table_search import get_table_binding_resolution
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
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.sigmaConnection import (
    SigmaConnection,
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
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.models.delete_entity import DeleteEntity
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.sigma.models import (
    DataModel,
    Elements,
    NodeDetails,
    Workbook,
    WorkbookDetails,
)
from metadata.ingestion.source.database.column_helpers import truncate_column_name
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart, filter_by_datamodel
from metadata.utils.helpers import (
    get_database_name_for_lineage,
    get_standard_chart_type,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Sigma connection types, lower-cased, as the spec names them for the warehouses OpenMetadata parses
SIGMA_CONNECTION_DIALECTS = {
    "bigquery": Dialect.BIGQUERY,
    "databricks": Dialect.DATABRICKS,
    "mysql": Dialect.MYSQL,
    "postgres": Dialect.POSTGRES,
    "redshift": Dialect.REDSHIFT,
    "snowflake": Dialect.SNOWFLAKE,
    "azuresql": Dialect.TSQL,
    "sqlserver": Dialect.TSQL,
}


class SigmaSource(DashboardServiceSource):
    """
    Sigma Source Class
    """

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SigmaConnection = config.serviceConnection.root.config
        if not isinstance(connection, SigmaConnection):
            raise InvalidSourceException(f"Expected SigmaConnection, but got {connection}")
        return cls(config, metadata)

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.data_models: list[Elements] = []

    def get_dashboards_list(self) -> list[Workbook] | None:
        """
        get list of dashboard
        """
        if not self.source_config.includeOwners:
            logger.debug("Skipping owner information as includeOwners is False")
        return self.client.get_dashboards()

    def get_dashboard_name(self, dashboard: Workbook) -> str | None:
        """
        get dashboard name
        """
        return dashboard.name

    def get_dashboard_details(self, dashboard: Workbook) -> WorkbookDetails | None:
        """
        get dashboard details
        """
        dashboard_details = self.client.get_dashboard_detail(dashboard.workbookId)
        if dashboard_details:
            dashboard_details.elements = self.client.get_chart_details(dashboard.workbookId) or []
        return dashboard_details

    def yield_dashboard(self, dashboard_details: WorkbookDetails) -> Iterable[Either[CreateDashboardRequest]]:
        """
        yield Dashboard Entity
        """
        if not dashboard_details:
            logger.warning(f"Skipping dashboard - details are None (API error)")  # noqa: F541
            return

        try:
            dashboard_request = CreateDashboardRequest(
                name=EntityName(str(dashboard_details.workbookId)),
                displayName=dashboard_details.name,
                description=(Markdown(dashboard_details.description) if dashboard_details.description else None),
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
                        fqn.build(  # pyright: ignore[reportArgumentType]  # always a str for DashboardDataModel
                            self.metadata,
                            entity_type=DashboardDataModel,
                            service_name=self.context.get().dashboard_service,  # pyright: ignore[reportAttributeAccessIssue]
                            data_model_name=data_model,
                        )
                    )
                    for data_model in self.context.get().dataModels or []  # pyright: ignore[reportAttributeAccessIssue]
                ]
                if self.source_config.includeDataModels
                else None,
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

    def yield_dashboard_chart(self, dashboard_details: WorkbookDetails) -> Iterable[Either[CreateChartRequest]]:
        """
        yield dashboard charts
        """
        if not dashboard_details:
            logger.warning(f"Skipping charts - dashboard details are None (API error)")  # noqa: F541
            return

        for chart in dashboard_details.elements:
            try:
                if filter_by_chart(self.source_config.chartFilterPattern, chart.name or ""):
                    self.status.filter(chart.name, "Chart Pattern not allowed")
                    continue
                chart_request = CreateChartRequest(
                    name=EntityName(str(chart.elementId)),
                    displayName=chart.name or f"Element {chart.elementId}",
                    chartType=get_standard_chart_type(chart.vizualizationType or ""),
                    service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                    sourceUrl=SourceUrl(dashboard_details.url),
                    description=(Markdown(dashboard_details.description) if dashboard_details.description else None),
                )
                yield Either(right=chart_request)
                self.register_record_chart(chart_request=chart_request)
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Chart",
                        error=(
                            f"Error to yield dashboard chart for : {chart.elementId} and {dashboard_details}: {exc}"
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

    @cached_property
    def _db_services(self) -> dict[str, DatabaseService | None]:
        """The database service of each dbServicePrefixes entry, read once per run"""
        return {
            prefix: self.metadata.get_by_name(entity=DatabaseService, fqn=prefix.split(".")[0])
            for prefix in self.get_db_service_prefixes()
        }

    def _get_table_entity(
        self, database: str | None, schema: str | None, table: str | None, db_service_prefix: str | None
    ) -> Table | None:
        """
        The one table the reference names across the dbServicePrefixes, returned on the call for the
        prefix it was found under. Lineage must not guess, so a reference matching several tables, or
        with no prefix configured, resolves to none.
        """
        if not (schema and table):
            return None
        matches: dict[str, tuple[Table, str]] = {}
        for prefix in self.get_db_service_prefixes():
            service, prefix_database, prefix_schema, prefix_table = self.parse_db_service_prefix(prefix)
            if any(
                expected and actual and expected.lower() != actual.lower()
                for expected, actual in ((prefix_database, database), (prefix_schema, schema), (prefix_table, table))
            ):
                continue
            service_entity = self._db_services[prefix]
            searched_database = (
                get_database_name_for_lineage(service_entity, database) if database and service_entity else database
            )
            try:
                found_tables = get_table_binding_resolution(self.metadata, service).resolve(
                    TableReference(searched_database or prefix_database, schema, table),
                    service_name=service,
                    lookup=TableLookup.SEARCH,
                )
            except UnsupportedTableReferenceError as exc:
                logger.debug(f"Skipping unsupported Sigma table reference {table} in {service}: {exc}")
                continue
            for found in found_tables:
                matches.setdefault(model_str(found.id), (found, prefix))
        if len(matches) != 1:
            logger.debug(f"Skipping Sigma table reference {table}: it matches {len(matches)} tables")
            return None
        found, prefix = next(iter(matches.values()))
        return found if prefix == db_service_prefix else None

    def _get_table_entity_from_node(
        self,
        node: NodeDetails,
        db_service_prefix: str | None = None,
    ) -> Table | None:
        """
        Get the table entity for lineage
        """
        if not node.node_schema:
            return None
        schema_parts = node.node_schema.split(".")
        try:
            return self._get_table_entity(
                schema_parts[0] if len(schema_parts) > 1 else None, schema_parts[-1], node.name, db_service_prefix
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error occured while finding table fqn: {exc}")
        return None

    def _yield_lineage_from_files(
        self,
        dashboard_details: WorkbookDetails,
        db_service_prefix: str | None = None,
    ):
        """
        Yield lineage using file-based API (fallback method)
        """
        for data_model in self.data_models or []:
            try:
                # Skip non-visualization elements to avoid Sigma API 500 errors.
                if not data_model.vizualizationType:
                    continue

                data_model_entity = self._get_datamodel(datamodel_id=data_model.elementId)
                if not data_model_entity:
                    continue

                nodes = self.client.get_lineage_details(dashboard_details.workbookId, data_model.elementId)

                if not nodes:
                    continue

                for node in nodes:
                    table_entity = self._get_table_entity_from_node(node, db_service_prefix)
                    if table_entity:
                        column_lineage = None
                        if data_model.columns:
                            columns_list = data_model.columns
                            column_lineage = self._get_column_lineage(table_entity, data_model_entity, columns_list)
                        yield self._get_add_lineage_request(
                            to_entity=data_model_entity,
                            from_entity=table_entity,
                            column_lineage=column_lineage,
                        )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=f"{dashboard_details.name} File-Based Lineage",
                        error=f"Error in file-based lineage: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _yield_lineage_from_files_for_element(
        self,
        dashboard_details: WorkbookDetails,
        data_model: Elements,
        db_service_prefix: str | None = None,
    ):
        """
        Yield lineage using file-based API for a single element (fallback per element)
        """
        try:
            data_model_entity = self._get_datamodel(datamodel_id=data_model.elementId)
            if not data_model_entity:
                return

            nodes = self.client.get_lineage_details(dashboard_details.workbookId, data_model.elementId)

            if not nodes:
                return

            for node in nodes:
                table_entity = self._get_table_entity_from_node(node, db_service_prefix)
                if table_entity:
                    column_lineage = None
                    if data_model.columns:
                        columns_list = data_model.columns
                        column_lineage = self._get_column_lineage(table_entity, data_model_entity, columns_list)
                    yield self._get_add_lineage_request(
                        to_entity=data_model_entity,
                        from_entity=table_entity,
                        column_lineage=column_lineage,
                    )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{dashboard_details.name} Element {data_model.elementId} File-Based Lineage",
                    error=f"Error in element file-based lineage fallback: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: WorkbookDetails,
        db_service_prefix: str | None = None,
    ):
        """
        Yield dashboard lineage using SQL query parsing (primary) or file-based (fallback)
        """
        if not dashboard_details:
            logger.warning(f"Skipping lineage - dashboard details are None (API error)")  # noqa: F541
            return

        queries_response = self.client.get_workbook_queries(dashboard_details.workbookId)

        if not queries_response or not queries_response.entries:
            yield from self._yield_lineage_from_files(dashboard_details, db_service_prefix)
            return

        db_service_entity = self._db_services.get(db_service_prefix) if db_service_prefix else None
        dialect = None

        queries_by_element = {q.elementId: q for q in queries_response.entries}

        for data_model in self.data_models or []:
            try:
                # Skip non-visualization elements (text boxes, dividers,
                # buttons, controls) to avoid Sigma API 500 errors on elements
                # that carry no upstream lineage.
                if not data_model.vizualizationType:
                    continue

                data_model_entity = self._get_datamodel(datamodel_id=data_model.elementId)
                if not data_model_entity:
                    continue

                query_obj = queries_by_element.get(data_model.elementId)

                if not query_obj or not query_obj.sql:
                    yield from self._yield_lineage_from_files_for_element(
                        dashboard_details, data_model, db_service_prefix
                    )
                    continue

                dialect = (
                    dialect
                    or self._workbook_dialect(dashboard_details)
                    or (
                        ConnectionTypeDialectMapper.dialect_of(db_service_entity.serviceType.value)
                        if db_service_entity
                        else Dialect.ANSI
                    )
                )
                lineage_parser = LineageParser(query_obj.sql, dialect, parser_type=self.get_query_parser_type())

                for source_table in lineage_parser.source_tables or []:
                    database_schema_table = fqn.split_table_name(str(source_table))
                    table_entity = self._get_table_entity(
                        database_schema_table.get("database"),
                        database_schema_table.get("database_schema"),
                        database_schema_table.get("table"),
                        db_service_prefix,
                    )
                    if table_entity:
                        yield self._get_add_lineage_request(
                            to_entity=data_model_entity,
                            from_entity=table_entity,
                        )

            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=f"{dashboard_details.name} Lineage",
                        error=(
                            "Error to yield dashboard lineage details for DB "
                            f"service prefix [{db_service_prefix}]: {exc}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _workbook_dialect(self, dashboard_details: WorkbookDetails) -> Dialect | None:
        """The dialect of the warehouse Sigma runs the workbook's SQL on, when all its sources use one connection"""
        connection_ids = dashboard_details.connection_ids
        if connection_ids is None:
            connection_ids = self.client.get_workbook_connection_ids(dashboard_details.workbookId)
            dashboard_details.connection_ids = connection_ids
        if len(connection_ids) != 1:
            return None
        connection_type = self.client.get_connection_type(next(iter(connection_ids)))
        return SIGMA_CONNECTION_DIALECTS.get((connection_type or "").lower())

    def get_column_info(self, element: Elements) -> list[Column] | None:
        """Build data model columns"""
        datamodel_columns = []
        for col in element.columns or []:
            try:
                datamodel_columns.append(
                    Column(
                        name=truncate_column_name(col),
                        displayName=col,
                        dataType=DataType.UNKNOWN,
                        dataTypeDisplay="Sigma Field",
                    )
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error to yield datamodel column: {exc}")
        return datamodel_columns

    def yield_datamodel(self, dashboard_details: WorkbookDetails) -> Iterable[Either[DashboardDataModel]]:
        if not dashboard_details:
            logger.warning(
                f"Skipping data models - dashboard details are None (API error)"  # noqa: F541
            )
            return

        if self.source_config.includeDataModels:
            self.data_models = dashboard_details.elements
            for data_model in self.data_models or []:
                # Skip non-visualization elements (text boxes, dividers, buttons, controls)
                # to avoid creating DataModel entries for elements that have no data source.
                if not data_model.vizualizationType:
                    continue
                try:
                    data_model_request = CreateDashboardDataModelRequest(
                        name=EntityName(data_model.elementId),
                        displayName=data_model.name or f"Element {data_model.elementId}",
                        service=FullyQualifiedEntityName(self.context.get().dashboard_service),
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

    def mark_dashboards_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        """Skip when a workbook read failed: the live workbooks it hid are missing from this run"""
        if self.client.workbooks_incomplete:
            logger.warning("Not marking dashboards as deleted: some Sigma workbooks could not be read")
            return
        yield from super().mark_dashboards_as_deleted()

    def mark_datamodels_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        """Skip when a workbook, element or data model read failed: the live data models it hid are missing"""
        if self.client.workbooks_incomplete or self.client.elements_incomplete or self.client.data_models_incomplete:
            logger.warning("Not marking data models as deleted: some Sigma workbooks or elements could not be read")
            return
        yield from super().mark_datamodels_as_deleted()

    def mark_charts_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        """Skip when a workbook or element read failed: the live charts it hid are missing from this run"""
        if self.client.workbooks_incomplete or self.client.elements_incomplete:
            logger.warning("Not marking charts as deleted: some Sigma workbooks or elements could not be read")
            return
        yield from super().mark_charts_as_deleted()

    def list_datamodels(self) -> Iterable[DataModel]:
        """Sigma Data Models, ingested before the workbooks that read from them"""
        return self.client.get_data_models() if self.source_config.includeDataModels else []

    def yield_bulk_datamodel(  # pyright: ignore[reportIncompatibleMethodOverride]
        self, data_model: DataModel
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """One data model per Sigma Data Model, with a table column per element, as PowerBI models a dataset"""
        display_name = data_model.name or data_model.dataModelId
        if filter_by_datamodel(self.source_config.dataModelFilterPattern, display_name):
            self.status.filter(display_name, "Data model filtered out.")
            return
        try:
            elements = self.client.get_data_model_elements(data_model.dataModelId)
            if elements is None:
                # Rebuilt from an unread element list, the data model would lose its columns: keep it as it is
                self.datamodel_source_state.add(
                    fqn.build(
                        self.metadata,
                        entity_type=DashboardDataModel,
                        service_name=vars(self.context.get())["dashboard_service"],
                        data_model_name=data_model.dataModelId,
                    )
                )
                return
            data_model_request = CreateDashboardDataModelRequest(
                name=EntityName(data_model.dataModelId),
                displayName=display_name,
                service=FullyQualifiedEntityName(vars(self.context.get())["dashboard_service"]),
                dataModelType=DataModelType.SigmaDataModel,
                serviceType=self.service_connection.type.value,
                sourceUrl=SourceUrl(data_model.url) if data_model.url else None,
                columns=[
                    Column(
                        name=ColumnName(truncate_column_name(element.elementId)),
                        displayName=element.name or element.elementId,
                        dataType=DataType.TABLE,
                        dataTypeDisplay="Sigma Data Model Element",
                        children=self.get_column_info(element),
                    )
                    for element in elements
                ],
            )
            yield Either(left=None, right=data_model_request)
            self.register_record_datamodel(datamodel_request=data_model_request)
        except Exception as exc:
            yield Either(
                right=None,
                left=StackTraceError(
                    name=data_model.dataModelId,
                    error=f"Error yielding Sigma data model [{data_model.dataModelId}]: {exc}",
                    stackTrace=traceback.format_exc(),
                ),
            )

    def get_owner_ref(self, dashboard_details: WorkbookDetails) -> EntityReferenceList | None:
        """
        Get owner from email
        """
        try:
            if not self.source_config.includeOwners:
                return None
            if dashboard_details.ownerId:
                owner = self.client.get_owner_detail(dashboard_details.ownerId)
                return self.metadata.get_reference_by_email(owner.email)
            return None  # noqa: TRY300
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner data due to {err}")
        return None
