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
"""PowerBI source module"""

import traceback
from typing import Any, Iterable, List, Optional, Union

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
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.powerbi.models import (
    Dataset,
    Group,
    PowerBIDashboard,
    PowerBIReport,
    PowerBiTable,
)
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.utils import fqn
from metadata.utils.filters import (
    filter_by_chart,
    filter_by_dashboard,
    filter_by_datamodel,
    filter_by_project,
)
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

    def prepare(self):
        if self.service_connection.useAdminApis:
            groups = self.get_admin_workspace_data()
        else:
            groups = self.get_org_workspace_data()
        if groups:
            self.workspace_data = self.get_filtered_workspaces(groups)
        return super().prepare()

    def close(self):
        self.metadata.close()
        if self.client.file_client:
            self.client.file_client.delete_tmp_files()

    def get_filtered_workspaces(self, groups: List[Group]) -> List[Group]:
        """
        Method to get the workspaces filtered by project filter pattern
        """
        filtered_groups = []
        for group in groups:
            if filter_by_project(
                self.source_config.projectFilterPattern,
                group.name,
            ):
                self.status.filter(
                    group.name,
                    "Workspace Filtered Out",
                )
                continue
            filtered_groups.append(group)
        return filtered_groups

    def get_org_workspace_data(self) -> Optional[List[Group]]:
        """
        fetch all the group workspace ids
        """
        groups = self.client.api_client.fetch_all_workspaces()
        for group in groups:
            # add the dashboards to the groups
            group.dashboards.extend(
                self.client.api_client.fetch_all_org_dashboards(group_id=group.id) or []
            )
            for dashboard in group.dashboards:
                # add the tiles to the dashboards
                dashboard.tiles.extend(
                    self.client.api_client.fetch_all_org_tiles(
                        group_id=group.id, dashboard_id=dashboard.id
                    )
                    or []
                )

            # add the reports to the groups
            group.reports.extend(
                self.client.api_client.fetch_all_org_reports(group_id=group.id) or []
            )

            # add the datasets to the groups
            group.datasets.extend(
                self.client.api_client.fetch_all_org_datasets(group_id=group.id) or []
            )
            for dataset in group.datasets:
                # add the tables to the datasets
                dataset.tables.extend(
                    self.client.api_client.fetch_dataset_tables(
                        group_id=group.id, dataset_id=dataset.id
                    )
                    or []
                )
        return groups

    def get_admin_workspace_data(self) -> Optional[List[Group]]:
        """
        fetch all the workspace ids
        """
        groups = []
        workspaces = self.client.api_client.fetch_all_workspaces()
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

                # Keep polling the scan status endpoint to check if scan is succeeded
                workspace_scan_status = self.client.api_client.wait_for_scan_complete(
                    scan_id=workspace_scan.id
                )
                if workspace_scan_status:
                    response = self.client.api_client.fetch_workspace_scan_result(
                        scan_id=workspace_scan.id
                    )
                    groups.extend(
                        [
                            active_workspace
                            for active_workspace in response.workspaces
                            if active_workspace.state == "Active"
                        ]
                    )
                else:
                    logger.error("Error in fetching dashboards and charts")
                count += 1
        else:
            logger.error("Unable to fetch any PowerBI workspaces")
        return groups or None

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

    def get_dashboard(self) -> Any:
        """
        Method to iterate through dashboard lists filter dashboards & yield dashboard details
        """
        for workspace in self.workspace_data:
            self.context.get().workspace = workspace
            for dashboard in self.get_dashboards_list():
                try:
                    dashboard_details = self.get_dashboard_details(dashboard)
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Cannot extract dashboard details from {dashboard}: {exc}"
                    )
                    continue
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
                yield dashboard_details

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
            f"{workspace_id}/dashboards/{dashboard_id}"
        )

    def _get_report_url(self, workspace_id: str, dashboard_id: str) -> str:
        """
        Method to build the dashboard url
        """
        return (
            f"{clean_uri(self.service_connection.hostPort)}/groups/"
            f"{workspace_id}/reports/{dashboard_id}"
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

    def list_datamodels(self) -> Iterable[Dataset]:
        """
        Get All the Powerbi Datasets
        """
        if self.source_config.includeDataModels:
            try:
                for workspace in self.workspace_data:
                    for dataset in workspace.datasets or []:
                        if filter_by_datamodel(
                            self.source_config.dataModelFilterPattern, dataset.name
                        ):
                            self.status.filter(dataset.name, "Data model filtered out.")
                            continue
                        yield dataset
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(f"Unexpected error fetching PowerBI datasets - {err}")

    def yield_bulk_datamodel(
        self, dataset: Dataset
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """
        Method to fetch DataModels in bulk
        """
        try:
            data_model_request = CreateDashboardDataModelRequest(
                name=EntityName(dataset.id),
                displayName=dataset.name,
                description=Markdown(dataset.description)
                if dataset.description
                else None,
                service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                dataModelType=DataModelType.PowerBIDataModel.value,
                serviceType=DashboardServiceType.PowerBI.value,
                columns=self._get_column_info(dataset),
                project=self._fetch_dataset_workspace(dataset_id=dataset.id),
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
                }
                child_columns = self._get_child_columns(table=table)
                if child_columns:
                    parsed_table["children"] = child_columns
                datasource_columns.append(Column(**parsed_table))
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error to yield datamodel column: {exc}")
        return datasource_columns

    def yield_dashboard(
        self, dashboard_details: Union[PowerBIDashboard, PowerBIReport]
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity, Dashboard Charts & Lineage
        """
        try:
            if isinstance(dashboard_details, PowerBIDashboard):
                dashboard_request = CreateDashboardRequest(
                    name=EntityName(dashboard_details.id),
                    sourceUrl=SourceUrl(
                        self._get_dashboard_url(
                            workspace_id=self.context.get().workspace.id,
                            dashboard_id=dashboard_details.id,
                        )
                    ),
                    project=self.get_project_name(dashboard_details=dashboard_details),
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
                    project=self.get_project_name(dashboard_details=dashboard_details),
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
        self, db_service_name: str, dashboard_details: PowerBIReport
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

    def _get_table_and_datamodel_lineage(
        self,
        db_service_name: str,
        table: PowerBiTable,
        datamodel_entity: DashboardDataModel,
    ) -> Optional[Either[AddLineageRequest]]:
        """
        Method to create lineage between table and datamodels
        """
        try:
            table_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=db_service_name,
                database_name=None,
                schema_name=None,
                table_name=table.name,
            )
            table_entity = self.metadata.get_by_name(
                entity=Table,
                fqn=table_fqn,
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
        db_service_name: str,
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
        dashboard_details: Union[PowerBIDashboard, PowerBIReport],
        db_service_name: str,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        We will build the logic to build the logic as below
        tables - datamodel - report - dashboard
        """
        try:
            if isinstance(dashboard_details, PowerBIReport):
                yield from self.create_datamodel_report_lineage(
                    db_service_name=db_service_name, dashboard_details=dashboard_details
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

    def yield_dashboard_chart(
        self, dashboard_details: Union[PowerBIDashboard, PowerBIReport]
    ) -> Iterable[Either[CreateChartRequest]]:
        """Get chart method
        Args:
            dashboard_details:
        Returns:
            Iterable[Chart]
        """
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

    def _fetch_dataset_workspace(self, dataset_id: Optional[str]) -> Optional[str]:
        """
        Method to search the workspace name in which the dataset in contained
        """
        if dataset_id:
            workspace_names = (
                workspace.name
                for workspace in self.workspace_data
                for dataset in workspace.datasets
                if dataset.id == dataset_id
            )
            return next(iter(workspace_names), None)

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
