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
import uuid
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
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.powerbi.models import (
    Dataset,
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
)
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PowerbiSource(DashboardServiceSource):
    """
    PowerBi Source Class
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)
        self.pagination_entity_per_page = min(
            100, self.service_connection.pagination_entity_per_page
        )
        self.workspace_data = []

    def prepare(self):
        if self.service_connection.useAdminApis:
            self.get_admin_workspace_data()
        else:
            self.get_org_workspace_data()
        return super().prepare()

    def get_org_workspace_data(self):
        """
        fetch all the group workspace ids
        """
        groups = self.client.fetch_all_workspaces()
        for group in groups:
            # add the dashboards to the groups
            group.dashboards.extend(
                self.client.fetch_all_org_dashboards(group_id=group.id) or []
            )
            for dashboard in group.dashboards:
                # add the tiles to the dashboards
                dashboard.tiles.extend(
                    self.client.fetch_all_org_tiles(
                        group_id=group.id, dashboard_id=dashboard.id
                    )
                    or []
                )

            # add the reports to the groups
            group.reports.extend(
                self.client.fetch_all_org_reports(group_id=group.id) or []
            )

            # add the datasets to the groups
            group.datasets.extend(
                self.client.fetch_all_org_datasets(group_id=group.id) or []
            )
            for dataset in group.datasets:
                # add the tables to the datasets
                dataset.tables.extend(
                    self.client.fetch_dataset_tables(
                        group_id=group.id, dataset_id=dataset.id
                    )
                    or []
                )
        self.workspace_data = groups

    def get_admin_workspace_data(self):
        """
        fetch all the workspace ids
        """
        workspaces = self.client.fetch_all_workspaces()
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
                workspace_scan = self.client.initiate_workspace_scan(
                    workspace_ids_chunk
                )

                # Keep polling the scan status endpoint to check if scan is succeeded
                workspace_scan_status = self.client.wait_for_scan_complete(
                    scan_id=workspace_scan.id
                )
                if workspace_scan_status:
                    response = self.client.fetch_workspace_scan_result(
                        scan_id=workspace_scan.id
                    )
                    self.workspace_data.extend(
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
            logger.error("Unable to fetch any Powerbi workspaces")

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: PowerBIConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, PowerBIConnection):
            raise InvalidSourceException(
                f"Expected PowerBIConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboard(self) -> Any:
        """
        Method to iterate through dashboard lists filter dashbaords & yield dashboard details
        """
        for workspace in self.workspace_data:
            self.context.workspace = workspace
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
                        "Dashboard Fltered Out",
                    )
                    continue
                yield dashboard_details

    def get_dashboards_list(
        self,
    ) -> Optional[List[Union[PowerBIDashboard, PowerBIReport]]]:
        """
        Get List of all dashboards
        """
        return self.context.workspace.reports + self.context.workspace.dashboards

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
    ) -> Iterable[CreateDashboardDataModelRequest]:
        """
        Method to fetch DataModels in bulk
        """
        try:
            data_model_request = CreateDashboardDataModelRequest(
                name=dataset.id,
                displayName=dataset.name,
                description=dataset.description,
                service=self.context.dashboard_service.fullyQualifiedName.__root__,
                dataModelType=DataModelType.PowerBIDataModel.value,
                serviceType=DashboardServiceType.PowerBI.value,
                columns=self._get_column_info(dataset),
            )
            yield data_model_request
            self.status.scanned(f"Data Model Scanned: {data_model_request.displayName}")
        except Exception as exc:
            error_msg = f"Error yielding Data Model [{dataset.name}]: {exc}"
            self.status.failed(
                name=dataset.name,
                error=error_msg,
                stack_trace=traceback.format_exc(),
            )
            logger.error(error_msg)
            logger.debug(traceback.format_exc())

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
                    "name": str(uuid.uuid4()),
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
        """
        Args:
            data_source: DataSource
        Returns:
            Columns details for Data Model
        """
        datasource_columns = []
        for table in dataset.tables or []:
            try:
                parsed_table = {
                    "dataTypeDisplay": "PowerBI Table",
                    "dataType": DataType.TABLE,
                    "name": str(uuid.uuid4()),
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
    ) -> Iterable[CreateDashboardRequest]:
        """
        Method to Get Dashboard Entity, Dashboard Charts & Lineage
        """
        try:
            if isinstance(dashboard_details, PowerBIDashboard):
                dashboard_request = CreateDashboardRequest(
                    name=dashboard_details.id,
                    dashboardUrl=self._get_dashboard_url(
                        workspace_id=self.context.workspace.id,
                        dashboard_id=dashboard_details.id,
                    ),
                    displayName=dashboard_details.displayName,
                    dashboardType=DashboardType.Dashboard,
                    charts=[
                        fqn.build(
                            self.metadata,
                            entity_type=Chart,
                            service_name=self.context.dashboard_service.fullyQualifiedName.__root__,
                            chart_name=chart.name.__root__,
                        )
                        for chart in self.context.charts
                    ],
                    service=self.context.dashboard_service.fullyQualifiedName.__root__,
                )
            else:
                dashboard_request = CreateDashboardRequest(
                    name=dashboard_details.id,
                    dashboardType=DashboardType.Report,
                    dashboardUrl=self._get_report_url(
                        workspace_id=self.context.workspace.id,
                        dashboard_id=dashboard_details.id,
                    ),
                    displayName=dashboard_details.name,
                    service=self.context.dashboard_service.fullyQualifiedName.__root__,
                )
            yield dashboard_request
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(f"Error creating dashboard [{dashboard_details}]: {exc}")

    def create_report_dashboard_lineage(
        self, dashboard_details: PowerBIDashboard
    ) -> Iterable[CreateDashboardRequest]:
        """
        create lineage between report and dashboard
        """
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
            logger.debug(traceback.format_exc())
            logger.error(f"Error to yield report and dashboard lineage details: {exc}")

    def create_datamodel_report_lineage(
        self, db_service_name: str, dashboard_details: PowerBIReport
    ) -> Iterable[CreateDashboardRequest]:
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
                    service_name=self.config.serviceName,
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

                    # create the lineage between table and datamodel
                    yield from self.create_table_datamodel_lineage(
                        db_service_name=db_service_name,
                        tables=dataset.tables,
                        datamodel_entity=datamodel_entity,
                    )
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error to yield datamodel and report lineage details for DB service name [{db_service_name}]: {exc}"
            )

    def create_table_datamodel_lineage(
        self,
        db_service_name: str,
        tables: Optional[List[PowerBiTable]],
        datamodel_entity: Optional[DashboardDataModel],
    ):
        """
        Method to create lineage between table and datamodels
        """
        for table in tables or []:
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
                    yield self._get_add_lineage_request(
                        to_entity=datamodel_entity, from_entity=table_entity
                    )
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error to yield datamodel lineage details for DB service name [{db_service_name}]: {exc}"
                )

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: Union[PowerBIDashboard, PowerBIReport],
        db_service_name: str,
    ) -> Iterable[AddLineageRequest]:
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
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error to yield dashboard lineage details for DB service name [{db_service_name}]: {exc}"
            )

    def yield_dashboard_chart(
        self, dashboard_details: Union[PowerBIDashboard, PowerBIReport]
    ) -> Optional[Iterable[CreateChartRequest]]:
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
                    yield CreateChartRequest(
                        name=chart.id,
                        displayName=chart_display_name,
                        chartType=ChartType.Other.value,
                        chartUrl=self._get_chart_url(
                            report_id=chart.reportId,
                            workspace_id=self.context.workspace.id,
                            dashboard_id=dashboard_details.id,
                        ),
                        service=self.context.dashboard_service.fullyQualifiedName.__root__,
                    )
                    self.status.scanned(chart_display_name)
                except Exception as exc:
                    name = chart.title
                    error = f"Error creating chart [{name}]: {exc}"
                    logger.debug(traceback.format_exc())
                    logger.warning(error)
                    self.status.failed(name, error, traceback.format_exc())

    def _fetch_dataset_from_workspace(
        self, dataset_id: Optional[str]
    ) -> Optional[Dataset]:
        """
        Method to search the dataset using id in the workspace dict
        """
        if dataset_id:
            dataset_data = next(
                (
                    dataset
                    for dataset in self.context.workspace.datasets or []
                    if dataset.id == dataset_id
                ),
                None,
            )
            return dataset_data
        return None

    def _fetch_report_from_workspace(
        self, report_id: Optional[str]
    ) -> Optional[Dataset]:
        """
        Method to search the report using id in the workspace dict
        """
        if report_id:
            report_data = next(
                (
                    report
                    for report in self.context.workspace.reports or []
                    if report.id == report_id
                ),
                None,
            )
            return report_data
        return None
