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
"""PowerBI source module"""

import re
import traceback
from typing import Any, Iterable, List, Optional, Union

from pydantic import EmailStr
from pydantic_core import PydanticCustomError

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart, ChartType
from metadata.generated.schema.entity.data.dashboard import Dashboard, DashboardType
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
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
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.powerbi.models import (
    Dataflow,
    Dataset,
    Group,
    PowerBIDashboard,
    PowerBiMeasureModel,
    PowerBIReport,
    PowerBiTable,
)
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.utils import fqn
from metadata.utils.filters import (
    filter_by_chart,
    filter_by_dashboard,
    filter_by_datamodel,
)
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PowerbiSource(DashboardServiceSource):
    """PowerBi Source Class"""

    config: WorkflowSource
    metadata_config: OpenMetadataConnection

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.pagination_entity_per_page = min(
            100, self.service_connection.pagination_entity_per_page
        )
        self.workspace_data = []
        self.datamodel_file_mappings = []

    def close(self):
        self.metadata.close()
        if self.client.file_client:
            self.client.file_client.delete_tmp_files()

    def get_org_workspace_data(self) -> Iterable[Optional[Group]]:
        """
        fetch all the workspace data for non-admin users
        """
        filter_pattern = self.source_config.projectFilterPattern
        workspaces = self.client.api_client.fetch_all_workspaces(filter_pattern)
        for workspace in workspaces:
            # add the dashboards to the workspace
            workspace.dashboards.extend(
                self.client.api_client.fetch_all_org_dashboards(group_id=workspace.id)
                or []
            )
            for dashboard in workspace.dashboards:
                # add the tiles to the dashboards
                dashboard.tiles.extend(
                    self.client.api_client.fetch_all_org_tiles(
                        group_id=workspace.id, dashboard_id=dashboard.id
                    )
                    or []
                )

            # add the reports to the workspaces
            workspace.reports.extend(
                self.client.api_client.fetch_all_org_reports(group_id=workspace.id)
                or []
            )

            # add the datasets to the workspaces
            workspace.datasets.extend(
                self.client.api_client.fetch_all_org_datasets(group_id=workspace.id)
                or []
            )
            for dataset in workspace.datasets:
                # add the tables to the datasets
                dataset.tables.extend(
                    self.client.api_client.fetch_dataset_tables(
                        group_id=workspace.id, dataset_id=dataset.id
                    )
                    or []
                )
            yield workspace

    def get_admin_workspace_data(self) -> Iterable[Optional[Group]]:
        """
        fetch all the workspace data
        """
        filter_pattern = self.source_config.projectFilterPattern
        workspaces = self.client.api_client.fetch_all_workspaces(filter_pattern)
        if workspaces:
            workspace_id_list = [workspace.id for workspace in workspaces]

            # Start the scan of the available workspaces for dashboard metadata
            workspace_paginated_list = [
                workspace_id_list[i : i + self.pagination_entity_per_page]
                for i in range(
                    0, len(workspace_id_list), self.pagination_entity_per_page
                )
            ]
            count = 1
            for workspace_ids_chunk in workspace_paginated_list:
                logger.info(
                    f"Scanning {count}/{len(workspace_paginated_list)} set of workspaces"
                )
                workspace_scan = self.client.api_client.initiate_workspace_scan(
                    workspace_ids_chunk
                )
                if not workspace_scan:
                    logger.error(
                        f"Error initiating workspace scan for ids:{str(workspace_ids_chunk)}\n moving to next set of workspaces"
                    )
                    count += 1
                    continue

                # Keep polling the scan status endpoint to check if scan is succeeded
                workspace_scan_status = self.client.api_client.wait_for_scan_complete(
                    scan_id=workspace_scan.id
                )
                if not workspace_scan_status:
                    logger.error(
                        f"Max poll hit to scan status for scan_id: {workspace_scan.id}, moving to next set of workspaces"
                    )
                    count += 1
                    continue

                # Get scan result for successfull scan
                response = self.client.api_client.fetch_workspace_scan_result(
                    scan_id=workspace_scan.id
                )
                if not response:
                    logger.error(
                        f"Error getting workspace scan result for scan_id: {workspace_scan.id}"
                    )
                    count += 1
                    continue
                for active_workspace in response.workspaces:
                    if active_workspace.state == "Active":
                        yield active_workspace
                count += 1
        else:
            logger.error("Unable to fetch any PowerBI workspaces")

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: PowerBIConnection = config.serviceConnection.root.config
        if not isinstance(connection, PowerBIConnection):
            raise InvalidSourceException(
                f"Expected PowerBIConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _prepare_workspace_data(self):
        """
        - Since we get all the required info i.e. reports, dashboards, charts, datasets
          with workflow scan approach, we are populating bulk data for workspace.
        - Some individual APIs are not able to yield data with details.
        """
        if self.service_connection.useAdminApis:
            for workspace in self.get_admin_workspace_data():
                yield workspace
        else:
            for workspace in self.get_org_workspace_data():
                yield workspace

    def get_dashboard(self) -> Any:
        """
        Method to iterate through dashboard lists filter dashboards & yield dashboard details
        """
        for workspace in self._prepare_workspace_data():
            self.workspace_data.append(workspace)
            self.context.get().workspace = workspace
            self.filtered_dashboards = []
            for dashboard in self.get_dashboards_list() or []:
                dashboard_details = self.get_dashboard_details(dashboard)
                dashboard_name = self.get_dashboard_name(dashboard_details)
                if filter_by_dashboard(
                    self.source_config.dashboardFilterPattern,
                    dashboard_name,
                ):
                    self.status.filter(
                        dashboard_name,
                        "Dashboard Filtered Out",
                    )
                    continue
                self.filtered_dashboards.append(dashboard_details)
            yield workspace

    def get_dashboards_list(
        self,
    ) -> Optional[List[Union[PowerBIDashboard, PowerBIReport]]]:
        """
        Get List of all dashboards
        """
        return (
            self.context.get().workspace.reports
            + self.context.get().workspace.dashboards
        )

    def get_dashboard_name(
        self, dashboard: Union[PowerBIDashboard, PowerBIReport]
    ) -> str:
        """
        Get Dashboard Name
        """
        if isinstance(dashboard, PowerBIDashboard):
            return dashboard.displayName
        return dashboard.name

    def get_dashboard_details(
        self, dashboard: Union[PowerBIDashboard, PowerBIReport]
    ) -> Union[PowerBIDashboard, PowerBIReport]:
        """
        Get Dashboard Details
        """
        return dashboard

    def _get_dashboard_url(self, workspace_id: str, dashboard_id: str) -> str:
        """
        Method to build the dashboard url
        """
        return (
            f"{clean_uri(self.service_connection.hostPort)}/groups/"
            f"{workspace_id}/dashboards/{dashboard_id}?experience=power-bi"
        )

    def _get_report_url(self, workspace_id: str, dashboard_id: str) -> str:
        """
        Method to build the dashboard url
        """
        return (
            f"{clean_uri(self.service_connection.hostPort)}/groups/"
            f"{workspace_id}/reports/{dashboard_id}/ReportSection?experience=power-bi"
        )

    def _get_chart_url(
        self, report_id: Optional[str], workspace_id: str, dashboard_id: str
    ) -> str:
        """
        Method to build the chart url
        """
        chart_url_postfix = (
            f"reports/{report_id}" if report_id else f"dashboards/{dashboard_id}"
        )
        return (
            f"{clean_uri(self.service_connection.hostPort)}/groups/"
            f"{workspace_id}/{chart_url_postfix}"
        )

    def yield_dashboard(
        self, dashboard_details: Group
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity, Dashboard Charts & Lineage
        """
        try:
            for dashboard in self.filtered_dashboards or []:
                dashboard_details = self.get_dashboard_details(dashboard)
                if isinstance(dashboard_details, PowerBIDashboard):
                    dashboard_request = CreateDashboardRequest(
                        name=EntityName(dashboard_details.id),
                        sourceUrl=SourceUrl(
                            self._get_dashboard_url(
                                workspace_id=self.context.get().workspace.id,
                                dashboard_id=dashboard_details.id,
                            )
                        ),
                        project=self.get_project_name(dashboard_details),
                        displayName=dashboard_details.displayName,
                        dashboardType=DashboardType.Dashboard,
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
                        service=FullyQualifiedEntityName(
                            self.context.get().dashboard_service
                        ),
                        owners=self.get_owner_ref(dashboard_details=dashboard_details),
                    )
                else:
                    dashboard_request = CreateDashboardRequest(
                        name=EntityName(dashboard_details.id),
                        dashboardType=DashboardType.Report,
                        sourceUrl=SourceUrl(
                            self._get_report_url(
                                workspace_id=self.context.get().workspace.id,
                                dashboard_id=dashboard_details.id,
                            )
                        ),
                        project=self.get_project_name(dashboard_details),
                        displayName=dashboard_details.name,
                        service=self.context.get().dashboard_service,
                        owners=self.get_owner_ref(dashboard_details=dashboard_details),
                    )
                yield Either(right=dashboard_request)
                self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.name,
                    error=f"Error creating dashboard [{dashboard_details}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_chart(
        self, dashboard_details: Group
    ) -> Iterable[Either[CreateChartRequest]]:
        """Get chart method
        Args:
            dashboard_details:
        Returns:
            Iterable[Chart]
        """
        for dashboard in self.filtered_dashboards or []:
            dashboard_details = self.get_dashboard_details(dashboard)
            if isinstance(dashboard_details, PowerBIDashboard):
                charts = dashboard_details.tiles
                for chart in charts or []:
                    try:
                        chart_title = chart.title
                        chart_display_name = chart_title if chart_title else chart.id
                        if filter_by_chart(
                            self.source_config.chartFilterPattern, chart_display_name
                        ):
                            self.status.filter(
                                chart_display_name, "Chart Pattern not Allowed"
                            )
                            continue
                        yield Either(
                            right=CreateChartRequest(
                                name=EntityName(chart.id),
                                displayName=chart_display_name,
                                chartType=ChartType.Other.value,
                                sourceUrl=SourceUrl(
                                    self._get_chart_url(
                                        report_id=chart.reportId,
                                        workspace_id=self.context.get().workspace.id,
                                        dashboard_id=dashboard_details.id,
                                    )
                                ),
                                service=FullyQualifiedEntityName(
                                    self.context.get().dashboard_service
                                ),
                            )
                        )
                    except Exception as exc:
                        yield Either(
                            left=StackTraceError(
                                name=chart.title,
                                error=f"Error creating chart [{chart.title}]: {exc}",
                                stackTrace=traceback.format_exc(),
                            )
                        )

    def _get_child_measures(self, table: PowerBiTable) -> List[Column]:
        """
        Extract the measures of the table
        """
        measures = []
        for measure in table.measures or []:
            try:
                measure_type = (
                    DataType.MEASURE_HIDDEN
                    if measure.isHidden
                    else DataType.MEASURE_VISIBLE
                )
                description_text = (
                    f"{measure.description}\n\nExpression : {measure.expression}"
                    if measure.description
                    else f"Expression : {measure.expression}"
                )
                parsed_measure = PowerBiMeasureModel(
                    dataType=measure_type,
                    dataTypeDisplay=measure_type,
                    name=measure.name,
                    description=description_text,
                )
                measures.append(Column(**parsed_measure.model_dump()))
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error processing datamodel nested measure: {err}")
        return measures

    def _get_child_columns(self, table: PowerBiTable) -> List[Column]:
        """
        Extract the child columns from the fields
        """
        columns = []
        for column in table.columns or []:
            try:
                parsed_column = {
                    "dataTypeDisplay": column.dataType
                    if column.dataType
                    else DataType.UNKNOWN.value,
                    "dataType": ColumnTypeParser.get_column_type(
                        column.dataType if column.dataType else None
                    ),
                    "name": column.name,
                    "displayName": column.name,
                    "description": column.description,
                }
                if column.dataType and column.dataType == DataType.ARRAY.value:
                    parsed_column["arrayDataType"] = DataType.UNKNOWN
                columns.append(Column(**parsed_column))
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error processing datamodel nested column: {exc}")
        return columns

    def _get_column_info(self, dataset: Dataset) -> Optional[List[Column]]:
        """Build columns from dataset"""
        datasource_columns = []
        for table in dataset.tables or []:
            try:
                parsed_table = {
                    "dataTypeDisplay": "PowerBI Table",
                    "dataType": DataType.TABLE,
                    "name": table.name,
                    "displayName": table.name,
                    "description": table.description,
                    "children": [],
                }
                child_columns = self._get_child_columns(table=table)
                child_measures = self._get_child_measures(table=table)
                if child_columns:
                    parsed_table["children"] = child_columns
                if child_measures:
                    parsed_table["children"].extend(child_measures)
                datasource_columns.append(Column(**parsed_table))
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error to yield datamodel column: {exc}")
        return datasource_columns

    def _get_datamodels_list(self) -> List[Union[Dataset, Dataflow]]:
        """
        Get All the Powerbi Datasets
        """
        return (
            self.context.get().workspace.datasets
            + self.context.get().workspace.dataflows
        )

    def yield_datamodel(
        self, dashboard_details: Group
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """
        Get All the Powerbi Datasets
        """
        try:
            if self.source_config.includeDataModels:
                for dataset in self._get_datamodels_list() or []:
                    if filter_by_datamodel(
                        self.source_config.dataModelFilterPattern, dataset.name
                    ):
                        self.status.filter(dataset.name, "Data model filtered out.")
                        continue
                    if isinstance(dataset, Dataset):
                        data_model_type = DataModelType.PowerBIDataModel.value
                        datamodel_columns = self._get_column_info(dataset)
                    elif isinstance(dataset, Dataflow):
                        data_model_type = DataModelType.PowerBIDataFlow.value
                        datamodel_columns = []
                    else:
                        logger.warning(
                            f"Unknown dataset type: {type(dataset)}, name: {dataset.name}"
                        )
                        continue
                    data_model_request = CreateDashboardDataModelRequest(
                        name=EntityName(dataset.id),
                        displayName=dataset.name,
                        description=Markdown(dataset.description)
                        if dataset.description
                        else None,
                        service=FullyQualifiedEntityName(
                            self.context.get().dashboard_service
                        ),
                        dataModelType=data_model_type,
                        serviceType=DashboardServiceType.PowerBI.value,
                        columns=datamodel_columns,
                        project=self.get_project_name(dashboard_details=dataset),
                        owners=self.get_owner_ref(dashboard_details=dataset),
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

    def create_report_dashboard_lineage(
        self, dashboard_details: PowerBIDashboard
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """Create lineage between report and dashboard"""
        try:
            charts = dashboard_details.tiles
            dashboard_fqn = fqn.build(
                self.metadata,
                entity_type=Dashboard,
                service_name=self.config.serviceName,
                dashboard_name=dashboard_details.id,
            )
            dashboard_entity = self.metadata.get_by_name(
                entity=Dashboard,
                fqn=dashboard_fqn,
            )
            for chart in charts or []:
                report = self._fetch_report_from_workspace(chart.reportId)
                if report:
                    report_fqn = fqn.build(
                        self.metadata,
                        entity_type=Dashboard,
                        service_name=self.config.serviceName,
                        dashboard_name=report.id,
                    )
                    report_entity = self.metadata.get_by_name(
                        entity=Dashboard,
                        fqn=report_fqn,
                    )

                    if report_entity and dashboard_entity:
                        yield self._get_add_lineage_request(
                            to_entity=dashboard_entity, from_entity=report_entity
                        )
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name="Lineage",
                    error=f"Error to yield report and dashboard lineage details: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def create_datamodel_report_lineage(
        self,
        db_service_name: Optional[str],
        dashboard_details: PowerBIReport,
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        create the lineage between datamodel and report
        """
        try:
            report_fqn = fqn.build(
                self.metadata,
                entity_type=Dashboard,
                service_name=self.config.serviceName,
                dashboard_name=dashboard_details.id,
            )
            report_entity = self.metadata.get_by_name(
                entity=Dashboard,
                fqn=report_fqn,
            )

            dataset = self._fetch_dataset_from_workspace(dashboard_details.datasetId)
            if dataset:
                datamodel_fqn = fqn.build(
                    self.metadata,
                    entity_type=DashboardDataModel,
                    service_name=self.context.get().dashboard_service,
                    data_model_name=dataset.id,
                )
                datamodel_entity = self.metadata.get_by_name(
                    entity=DashboardDataModel,
                    fqn=datamodel_fqn,
                )

                if datamodel_entity and report_entity:
                    yield self._get_add_lineage_request(
                        to_entity=report_entity, from_entity=datamodel_entity
                    )

                    for table in dataset.tables or []:
                        yield self._get_table_and_datamodel_lineage(
                            db_service_name=db_service_name,
                            table=table,
                            datamodel_entity=datamodel_entity,
                        )

                    # create the lineage between table and datamodel using the pbit files
                    if self.client.file_client:
                        yield from self.create_table_datamodel_lineage_from_files(
                            db_service_name=db_service_name,
                            datamodel_entity=datamodel_entity,
                        )
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name=f"{db_service_name} Report Lineage",
                    error=(
                        "Error to yield datamodel and report lineage details for DB "
                        f"service name [{db_service_name}]: {exc}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )

    @staticmethod
    def _get_data_model_column_fqn(
        data_model_entity: DashboardDataModel, column: str
    ) -> Optional[str]:
        """
        Get fqn of column if exist in data model entity or its child columns
        """
        try:
            if not data_model_entity:
                return None
            for tbl_column in data_model_entity.columns:
                for child_column in tbl_column.children or []:
                    if column.lower() == child_column.name.root.lower():
                        return child_column.fullyQualifiedName.root
            return None
        except Exception as exc:
            logger.debug(f"Error to get data_model_column_fqn {exc}")
            logger.debug(traceback.format_exc())

    def _parse_snowflake_regex_exp(
        self, match: re.Match, datamodel_entity: DashboardDataModel
    ) -> Optional[str]:
        """parse snowflake regex expression"""
        try:
            if not match:
                return None
            elif match.group(1):
                return match.group(1)
            elif match.group(2):
                dataset = self._fetch_dataset_from_workspace(datamodel_entity.name.root)
                if dataset and dataset.expressions:
                    # find keyword from dataset expressions
                    for dexpression in dataset.expressions:
                        if not dexpression.expression:
                            logger.debug(
                                f"No expression value found inside dataset"
                                f"({dataset.name}) expressions' name={dexpression.name}"
                            )
                            continue
                        if dexpression.name == match.group(2):
                            pattern = r'DefaultValue="([^"]+)"'
                            kw_match = re.search(pattern, dexpression.expression)
                            if kw_match:
                                return kw_match.group(1)
        except Exception as exc:
            logger.debug(f"Error to parse snowflake regex expression: {exc}")
            logger.debug(traceback.format_exc())
        return None

    def _parse_redshift_source(self, source_expression: str) -> Optional[dict]:
        try:
            db_match = re.search(
                r'AmazonRedshift\.Database\("[^"]+","([^"]+)"\)', source_expression
            )
            if not db_match:
                # not valid redshift source
                return None
            schema_table_match = re.findall(r'\[Name="([^"]+)"\]', source_expression)

            database = db_match.group(1) if db_match else None
            schema = table = None
            if isinstance(schema_table_match, list):
                schema = schema_table_match[0] if len(schema_table_match) > 0 else None
                table = schema_table_match[1] if len(schema_table_match) > 1 else None

            if table:  # atlease table should be fetched
                return {"database": database, "schema": schema, "table": table}
            return None
        except Exception as exc:
            logger.debug(f"Error to parse redshift table source: {exc}")
            logger.debug(traceback.format_exc())
        return None

    def _parse_snowflake_source(
        self, source_expression: str, datamodel_entity: DashboardDataModel
    ) -> Optional[dict]:
        try:
            if "Snowflake.Databases" not in source_expression:
                # Not a snowflake valid expression
                return None
            db_match = re.search(
                r'\[Name=(?:"([^"]+)"|([^,]+)),Kind="Database"\]', source_expression
            )
            schema_match = re.search(
                r'\[Name=(?:"([^"]+)"|([^,]+)),Kind="Schema"\]', source_expression
            )
            table_match = re.search(
                r'\[Name=(?:"([^"]+)"|([^,]+)),Kind="Table"\]', source_expression
            )
            view_match = re.search(
                r'\[Name=(?:"([^"]+)"|([^,]+)),Kind="View"\]', source_expression
            )

            database = self._parse_snowflake_regex_exp(db_match, datamodel_entity)
            schema = self._parse_snowflake_regex_exp(schema_match, datamodel_entity)
            table = self._parse_snowflake_regex_exp(table_match, datamodel_entity)
            view = self._parse_snowflake_regex_exp(view_match, datamodel_entity)

            if table or view:  # atlease table or view should be fetched
                return {
                    "database": database,
                    "schema": schema,
                    "table": table if table else view,
                }
            return None
        except Exception as exc:
            logger.debug(f"Error to parse snowflake table source: {exc}")
            logger.debug(traceback.format_exc())
        return None

    def _parse_table_info_from_source_exp(
        self, table: PowerBiTable, datamodel_entity: DashboardDataModel
    ) -> dict:
        try:
            if not isinstance(table.source, list):
                return {}
            source_expression = table.source[0].expression
            if not source_expression:
                logger.debug(f"No source expression found for table: {table.name}")
                return {}
            # parse snowflake source
            table_info = self._parse_snowflake_source(
                source_expression, datamodel_entity
            )
            if isinstance(table_info, dict):
                return table_info
            # parse redshift source
            table_info = self._parse_redshift_source(source_expression)
            if isinstance(table_info, dict):
                return table_info
            return {}
        except Exception as exc:
            logger.debug(f"Error to parse table source: {exc}")
            logger.debug(traceback.format_exc())
        return {}

    def _get_table_and_datamodel_lineage(
        self,
        db_service_name: Optional[str],
        table: PowerBiTable,
        datamodel_entity: DashboardDataModel,
    ) -> Optional[Either[AddLineageRequest]]:
        """
        Method to create lineage between table and datamodels
        """
        try:
            table_info = self._parse_table_info_from_source_exp(table, datamodel_entity)
            fqn_search_string = build_es_fqn_search_string(
                service_name=db_service_name or "*",
                table_name=table_info.get("table") or table.name,
                schema_name=table_info.get("schema") or "*",
                database_name=table_info.get("database") or "*",
            )
            table_entity = self.metadata.search_in_any_service(
                entity_type=Table,
                fqn_search_string=fqn_search_string,
            )
            if table_entity and datamodel_entity:
                columns_list = [column.name for column in table.columns]
                column_lineage = self._get_column_lineage(
                    table_entity, datamodel_entity, columns_list
                )
                return self._get_add_lineage_request(
                    to_entity=datamodel_entity,
                    from_entity=table_entity,
                    column_lineage=column_lineage,
                )
        except Exception as exc:  # pylint: disable=broad-except
            return Either(
                left=StackTraceError(
                    name="DataModel Lineage for pbit files",
                    error=(
                        "Error to yield datamodel lineage details using pbit files for"
                        f"datamodel [{datamodel_entity.name}]: {exc}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )
        return None

    def create_table_datamodel_lineage_from_files(
        self,
        db_service_name: Optional[str],
        datamodel_entity: Optional[DashboardDataModel],
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Method to create lineage between table and datamodels using pbit files
        """
        try:
            # check if the datamodel_file_mappings is populated or not
            # if not, then populate the datamodel_file_mappings and process the lineage
            if not self.datamodel_file_mappings:
                self.datamodel_file_mappings = (
                    self.client.file_client.get_data_model_schema_mappings()
                )

            # search which file contains the datamodel and for the given datamodel_entity
            datamodel_file_list = []
            for datamodel_schema in self.datamodel_file_mappings or []:
                for connections in (
                    datamodel_schema.connectionFile.RemoteArtifacts or []
                ):
                    if connections.DatasetId == model_str(datamodel_entity.name):
                        datamodel_file_list.append(datamodel_schema)

            for datamodel_schema_file in datamodel_file_list:
                for table in datamodel_schema_file.tables or []:
                    yield self._get_table_and_datamodel_lineage(
                        db_service_name=db_service_name,
                        table=table,
                        datamodel_entity=datamodel_entity,
                    )
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name="DataModel Lineage",
                    error=(
                        "Error to yield datamodel lineage details for DB "
                        f"service name [{db_service_name}]: {exc}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: Group,
        db_service_name: Optional[str] = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        We will build the logic to build the logic as below
        tables - datamodel - report - dashboard
        """
        for dashboard in self.filtered_dashboards or []:
            dashboard_details = self.get_dashboard_details(dashboard)
            try:
                if isinstance(dashboard_details, PowerBIReport):
                    yield from self.create_datamodel_report_lineage(
                        db_service_name=db_service_name,
                        dashboard_details=dashboard_details,
                    )
                if isinstance(dashboard_details, PowerBIDashboard):
                    yield from self.create_report_dashboard_lineage(
                        dashboard_details=dashboard_details
                    )
            except Exception as exc:  # pylint: disable=broad-except
                yield Either(
                    left=StackTraceError(
                        name="Dashboard Lineage",
                        error=f"Error to yield dashboard lineage details for DB service name [{db_service_name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_dashboard_lineage(
        self, dashboard_details: Group
    ) -> Iterable[Either[OMetaLineageRequest]]:
        """
        Yields lineage if config is enabled.

        We will look for the data in all the services
        we have informed.
        """
        db_service_names = self.get_db_service_names()
        if not db_service_names:
            yield from self.yield_dashboard_lineage_details(dashboard_details) or []
        for db_service_name in db_service_names or []:
            yield from self.yield_dashboard_lineage_details(
                dashboard_details, db_service_name
            ) or []

    def _fetch_dataset_from_workspace(
        self, dataset_id: Optional[str]
    ) -> Optional[Dataset]:
        """
        Method to search the dataset using id in the workspace dict
        """
        if dataset_id:
            for workspace in self.workspace_data or []:
                dataset_data = next(
                    (
                        dataset
                        for dataset in workspace.datasets or []
                        if dataset.id == dataset_id
                    ),
                    None,
                )
                if dataset_data:
                    return dataset_data
        return None

    def _fetch_report_from_workspace(
        self, report_id: Optional[str]
    ) -> Optional[Dataset]:
        """
        Method to search the report using id in the workspace dict
        """
        if report_id:
            for workspace in self.workspace_data or []:
                report_data = next(
                    (
                        report
                        for report in workspace.reports or []
                        if report.id == report_id
                    ),
                    None,
                )
                if report_data:
                    return report_data
        return None

    def get_project_name(self, dashboard_details: Any) -> Optional[str]:
        """
        Get the project / workspace / folder / collection name of the dashboard
        """
        try:
            return str(self.context.get().workspace.name)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error fetching project name for {dashboard_details.id}: {exc}"
            )
        return None

    def get_owner_ref(  # pylint: disable=unused-argument, useless-return
        self, dashboard_details: Any
    ) -> Optional[EntityReferenceList]:
        """
        Method to process the dashboard owners
        """
        try:
            owner_ref_list = []  # to assign multiple owners to entity if they exist
            for owner in dashboard_details.users or []:
                owner_ref = None
                # put filtering conditions
                if isinstance(dashboard_details, Dataset):
                    access_right = owner.datasetUserAccessRight
                elif isinstance(dashboard_details, Dataflow):
                    access_right = owner.dataflowUserAccessRight
                elif isinstance(dashboard_details, PowerBIReport):
                    access_right = owner.reportUserAccessRight
                elif isinstance(dashboard_details, PowerBIDashboard):
                    access_right = owner.dashboardUserAccessRight

                if owner.userType != "Member" or (
                    isinstance(
                        dashboard_details, (Dataflow, PowerBIReport, PowerBIDashboard)
                    )
                    and access_right != "Owner"
                ):
                    logger.warning(
                        f"User is not a member and has no access to the {dashboard_details.id}: ({owner.displayName}, {owner.email})"
                    )
                    continue
                if owner.email:
                    try:
                        owner_email = EmailStr._validate(owner.email)
                    except PydanticCustomError:
                        logger.warning(f"Invalid email for owner: {owner.email}")
                        owner_email = None
                    if owner_email:
                        try:
                            owner_ref = self.metadata.get_reference_by_email(
                                owner_email.lower()
                            )
                        except Exception as err:
                            logger.warning(
                                f"Could not fetch owner data with email {owner.email} in {dashboard_details.id}: {err}"
                            )
                elif owner.displayName:
                    try:
                        owner_ref = self.metadata.get_reference_by_name(
                            name=owner.displayName
                        )
                    except Exception as err:
                        logger.warning(
                            f"Could not process owner data with name {owner.displayName} in {dashboard_details.id}: {err}"
                        )
                if owner_ref:
                    owner_ref_list.append(owner_ref.root[0])
            # check for last modified, configuredBy user
            current_active_user = None
            if isinstance(dashboard_details, Dataset):
                current_active_user = dashboard_details.configuredBy
            elif isinstance(dashboard_details, (Dataflow, PowerBIReport)):
                current_active_user = dashboard_details.modifiedBy
            if current_active_user:
                try:
                    owner_ref = self.metadata.get_reference_by_email(
                        current_active_user.lower()
                    )
                    if owner_ref and owner_ref.root[0] not in owner_ref_list:
                        owner_ref_list.append(owner_ref.root[0])
                except Exception as err:
                    logger.warning(f"Could not fetch owner data due to {err}")
            if len(owner_ref_list) > 0:
                logger.debug(
                    f"Successfully fetched owners data for {dashboard_details.id}"
                )
                return EntityReferenceList(root=owner_ref_list)
            return None
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner data due to {err}")
        return None
