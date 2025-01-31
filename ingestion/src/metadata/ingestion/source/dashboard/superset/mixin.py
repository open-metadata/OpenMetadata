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
Superset mixin module
"""
import json
import traceback
from typing import Iterable, List, Optional, Union

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.supersetConnection import (
    SupersetConnection,
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
from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import (
    get_column_fqn,
    get_dashboard_data_model_column_fqn,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.superset.models import (
    DashboardResult,
    DataSourceResult,
    FetchChart,
    FetchColumn,
    FetchDashboard,
    SupersetDatasource,
)
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SupersetSourceMixin(DashboardServiceSource):
    """
    Superset DB Source Class
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection
    platform = "superset"
    service_type = DashboardServiceType.Superset.value
    service_connection: SupersetConnection

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.all_charts = {}

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: SupersetConnection = config.serviceConnection.root.config
        if not isinstance(connection, SupersetConnection):
            raise InvalidSourceException(
                f"Expected SupersetConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_dashboard_name(
        self, dashboard: Union[FetchDashboard, DashboardResult]
    ) -> Optional[str]:
        """
        Get Dashboard Name
        """
        return dashboard.dashboard_title

    def get_dashboard_details(
        self, dashboard: Union[FetchDashboard, DashboardResult]
    ) -> Optional[Union[FetchDashboard, DashboardResult]]:
        """
        Get Dashboard Details
        """
        return dashboard

    def _get_user_by_email(self, email: Optional[str]) -> Optional[EntityReferenceList]:
        if email:
            return self.metadata.get_reference_by_email(email)
        return None

    def get_owner_ref(
        self, dashboard_details: Union[DashboardResult, FetchDashboard]
    ) -> Optional[EntityReferenceList]:
        try:
            if hasattr(dashboard_details, "owners"):
                for owner in dashboard_details.owners or []:
                    if owner.email:
                        user = self._get_user_by_email(owner.email)
                        if user:
                            return user
            if dashboard_details.email:
                user = self._get_user_by_email(dashboard_details.email)
                if user:
                    return user
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner data due to {err}")
        return None

    def _get_charts_of_dashboard(
        self, dashboard_details: Union[FetchDashboard, DashboardResult]
    ) -> Optional[List[str]]:
        """
        Method to fetch chart ids linked to dashboard
        """
        try:
            raw_position_data = dashboard_details.position_json
            if raw_position_data:
                position_data = json.loads(raw_position_data)
                return [
                    value.get("meta", {}).get("chartId")
                    for key, value in position_data.items()
                    if key.startswith("CHART-") and value.get("meta", {}).get("chartId")
                ]
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to charts of dashboard {dashboard_details.id} due to {err}"
            )
        return []

    def parse_lineage_from_dataset_sql(
        self, chart_json: FetchChart
    ) -> list[tuple[FetchChart, dict[str, list[str]]]]:
        # Every SQL query in tables is a SQL statement SELECTING data.
        # To get lineage we 'simulate' INSERT INTO query by treating chart dataset as 'destination'
        # table.
        result = []

        parser = LineageParser(f"INSERT INTO {chart_json.table_name} {chart_json.sql}")
        for table in parser.source_tables:
            table_name = table.raw_name
            table_schema = (
                table.schema.raw_name
                if table.schema.raw_name != table.schema.unknown
                else chart_json.table_schema
            )

            column_mapping: dict[str, list[str]] = {}

            for c in parser.column_lineage:
                if "Table" in str(type(c[0].parent)) and "Table" in str(
                    type(c[-1].parent)
                ):
                    from_column_name = c[0].raw_name
                    to_column_name = c[-1].raw_name

                    if from_column_name != "*" and to_column_name != "*":
                        if column_mapping.get(to_column_name):
                            column_mapping[to_column_name].append(from_column_name)
                        else:
                            column_mapping[to_column_name] = [from_column_name]

                    if from_column_name == "*" and to_column_name == "*":
                        for col_name in self._get_columns_list_for_lineage(chart_json):
                            if column_mapping.get(col_name):
                                column_mapping[col_name].append(col_name)
                            else:
                                column_mapping[col_name] = [col_name]

            result.append(
                (
                    FetchChart(
                        table_name=table_name,
                        table_schema=table_schema,
                        sqlalchemy_uri=chart_json.sqlalchemy_uri,
                    ),
                    column_mapping,
                )
            )

        return result

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: Union[FetchDashboard, DashboardResult],
        db_service_name: DatabaseService,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between datamodel and table
        """
        db_service_entity = self.metadata.get_by_name(
            entity=DatabaseService, fqn=db_service_name
        )
        if db_service_entity:
            for chart_id in self._get_charts_of_dashboard(dashboard_details):
                chart_json: FetchChart = self.all_charts.get(chart_id)
                if chart_json:
                    try:
                        if chart_json.sql:
                            input_tables_raw = self.parse_lineage_from_dataset_sql(
                                chart_json
                            )
                        else:
                            input_tables_raw = [
                                (
                                    chart_json,
                                    {
                                        c: [c]
                                        for c in self._get_columns_list_for_lineage(
                                            chart_json
                                        )
                                    },
                                )
                            ]

                        datamodel_fqn = fqn.build(
                            self.metadata,
                            entity_type=DashboardDataModel,
                            service_name=self.config.serviceName,
                            data_model_name=str(chart_json.datasource_id),
                        )
                        to_entity = self.metadata.get_by_name(
                            entity=DashboardDataModel,
                            fqn=datamodel_fqn,
                        )

                        input_tables: list[tuple[Table, list[ColumnLineage]]] = []
                        # Enrich raw objects with OM FQNs
                        for raw_input_table in input_tables_raw:
                            input_table, _column_lineage = raw_input_table
                            datasource_fqn = self._get_datasource_fqn_for_lineage(
                                input_table, db_service_entity
                            )
                            from_entity = self.metadata.get_by_name(
                                entity=Table,
                                fqn=datasource_fqn,
                            )

                            column_lineage: List[ColumnLineage] = []
                            for to_column, from_columns in _column_lineage.items():
                                _from_columns = [
                                    get_column_fqn(from_entity, from_column)
                                    for from_column in from_columns
                                    if get_column_fqn(from_entity, from_column)
                                ]

                                _to_column = get_dashboard_data_model_column_fqn(
                                    to_entity, to_column
                                )

                                if _from_columns and _to_column:
                                    column_lineage.append(
                                        ColumnLineage(
                                            fromColumns=_from_columns,
                                            toColumn=_to_column,
                                        )
                                    )

                            input_tables.append((from_entity, column_lineage))

                        if to_entity:
                            for input_table in input_tables:
                                from_entity_table, column_lineage = input_table

                                yield self._get_add_lineage_request(
                                    to_entity=to_entity,
                                    from_entity=from_entity_table,
                                    column_lineage=column_lineage,
                                )
                    except Exception as exc:
                        yield Either(
                            left=StackTraceError(
                                name=db_service_name,
                                error=(
                                    "Error to yield dashboard lineage details for DB "
                                    f"service name [{db_service_name}]: {exc}"
                                ),
                                stackTrace=traceback.format_exc(),
                            )
                        )

    def _get_datamodel(
        self, datamodel: Union[SupersetDatasource, FetchChart]
    ) -> Optional[DashboardDataModel]:
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

    def _clearn_column_datatype(self, datatype: str) -> str:
        """clean datatype of column fetched from superset"""
        return datatype.replace("()", "")


    def parse_array_data_type(self, col_parse: dict) -> Optional[str]:
        """
        Set arrayDataType to UNKNOWN for Snowflake table array columns
        to prevent validation error requiring non-null arrayDataType
        """
        if col_parse["dataType"] == "ARRAY" and not col_parse.get("arrayDataType"):
            return DataType.UNKNOWN
        if col_parse.get("arrayDataType"):
            return DataType(col_parse["arrayDataType"])
        return None


    def parse_row_data_type(self, col_parse: dict) -> List[Column]:
        """
        Set children to single UNKNOWN column for Trino row columns
        to prevent validation error requiring non empty list of children.
        """
        if col_parse["dataType"] == "ROW" and not col_parse.get("children"):
            return [Column(name="unknown", dataType=DataType.UNKNOWN)]

        if col_parse.get("children"):
            return col_parse["children"]

    def get_column_info(
        self, data_source: List[Union[DataSourceResult, FetchColumn]]
    ) -> Optional[List[Column]]:
        """
        Args:
            data_source: DataSource
        Returns:
            Columns details for Data Model
        """
        datasource_columns = []
        for field in data_source or []:
            try:
                if field.type:
                    field.type = self._clearn_column_datatype(field.type)
                    col_parse = ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
                        field.type
                    )
                    parsed_fields = Column(
                        dataTypeDisplay=field.type,
                        dataType=col_parse["dataType"],
                        arrayDataType=self.parse_array_data_type(col_parse),
                        children=self.parse_row_data_type(col_parse),
                        name=str(field.id),
                        displayName=field.column_name,
                        description=field.description,
                        dataLength=int(col_parse.get("dataLength", 0)),
                    )
                    datasource_columns.append(parsed_fields)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error to yield datamodel column: {exc}")
        return datasource_columns
