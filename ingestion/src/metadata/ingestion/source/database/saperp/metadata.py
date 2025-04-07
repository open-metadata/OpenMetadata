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
"""
SAP ERP source module
"""
import traceback
from typing import Iterable, List, Optional, Tuple

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    Constraint,
    ConstraintType,
    DataType,
    Table,
    TableConstraint,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.sapErpConnection import (
    SapErpConnection,
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
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.saperp.constants import TABLE_TYPE_MAP
from metadata.ingestion.source.database.saperp.models import (
    ColumnsAndConstraints,
    SapErpColumn,
    SapErpTable,
    TableConstraintsModel,
)
from metadata.utils import fqn
from metadata.utils.execution_time_tracker import calculate_execution_time_generator
from metadata.utils.filters import filter_by_table
from metadata.utils.helpers import clean_up_starting_ending_double_quotes_in_string
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SaperpSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Sap ERP Source
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SapErpConnection = config.serviceConnection.root.config
        if not isinstance(connection, SapErpConnection):
            raise InvalidSourceException(
                f"Expected SapErpConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_raw_database_schema_names(self) -> Iterable[str]:
        if self.service_connection.__dict__.get("databaseSchema"):
            yield self.service_connection.databaseSchema
        else:
            yield "default"

    def get_tables_name_and_type(self) -> Optional[Iterable[SapErpTable]]:
        """
        Ingest the tables from SAP ERP
        """
        for table in self.connection_obj.list_tables() or []:
            try:
                table_name = table.tabname
                table_type = TABLE_TYPE_MAP.get(table.tabclass, TableType.Regular)
                if (
                    table_type == TableType.Regular and self.source_config.includeTables
                ) or (table_type == TableType.View and self.source_config.includeViews):
                    table_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                        table_name=table_name,
                        skip_es_search=True,
                    )
                    if filter_by_table(
                        self.source_config.tableFilterPattern,
                        (
                            table_fqn
                            if self.source_config.useFqnForFiltering
                            else table_name
                        ),
                    ):
                        self.status.filter(
                            table_fqn,
                            "Table Filtered Out",
                        )
                        continue
                    yield table

            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unable to process table information for table: {str(table_name)} - {err}"
                )

    def _check_col_length(  # pylint: disable=arguments-differ
        self, datatype: str, col_length: Optional[str], col_decimals: Optional[str]
    ) -> Tuple[Optional[int], Optional[int]]:
        """
        return the column length for the dataLength attribute
        """
        try:
            return (
                int(col_length) if col_length else None,
                int(col_decimals) if col_decimals else None,
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch column length: {exc}")
        return None, None

    def _get_table_constraints(
        self, columns: Optional[List[Column]]
    ) -> TableConstraintsModel:
        """
        Method to get the table constraints
        """
        try:
            table_constraints = []
            pk_columns = []
            # check if we have multiple primary keys and add them to the TableConstraints
            for column in columns or []:
                if column.keyflag:
                    pk_columns.append(
                        clean_up_starting_ending_double_quotes_in_string(
                            column.fieldname
                        )
                    )
            if len(pk_columns) > 1:
                table_constraints.append(
                    TableConstraint(
                        constraintType=ConstraintType.PRIMARY_KEY,
                        columns=pk_columns,
                    )
                )
                return TableConstraintsModel(
                    table_constraints=table_constraints or None, pk_columns=pk_columns
                )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch table constraints: {exc}")
        return TableConstraintsModel()

    def _get_column_constraint(self, column: SapErpColumn, pk_columns: List[str]):
        """
        Method to get the column constraint
        """
        if column.keyflag:
            # In case of multiple primary keys return None for column constraints
            # Multiple primary keys will be handled in table constraints
            if len(pk_columns) > 1:
                return None
            return Constraint.PRIMARY_KEY
        return Constraint.NOT_NULL if column.notnull == "X" else Constraint.NULL

    def _get_display_datatype(  # pylint: disable=arguments-differ
        self,
        column_type: str,
        col_data_length: Optional[int],
        decimals: Optional[int],
        sap_column_type: Optional[str],
    ) -> str:
        """
        Method to get the display datatype
        """
        column_type_name = sap_column_type if sap_column_type else column_type
        if col_data_length and decimals:
            return f"{column_type_name}({str(col_data_length)},{str(decimals)})"
        if col_data_length:
            return f"{column_type_name}({str(col_data_length)})"
        return column_type_name

    def get_columns_and_constraints(  # pylint: disable=arguments-differ
        self, table_name: str
    ) -> ColumnsAndConstraints:
        """
        Method to get the column metadata
        """
        sap_columns = self.connection_obj.list_columns(table_name)
        table_constraints_model = self._get_table_constraints(columns=sap_columns)
        om_columns = []
        for sap_column in sap_columns or []:
            try:
                column_type = ColumnTypeParser.get_column_type(sap_column.datatype)
                col_data_length, col_decimal_length = self._check_col_length(
                    datatype=column_type,
                    col_length=sap_column.leng,
                    col_decimals=sap_column.decimals,
                )
                column_name = (
                    f"{sap_column.fieldname}({sap_column.precfield})"
                    if sap_column.precfield
                    else sap_column.fieldname
                )
                if sap_column.datatype is None:
                    column_type = DataType.UNKNOWN.name
                    data_type_display = column_type.lower()
                    logger.warning(
                        f"Unknown type {repr(sap_column.datatype)}: {sap_column.fieldname}"
                    )
                data_type_display = self._get_display_datatype(
                    column_type,
                    col_data_length,
                    col_decimal_length,
                    sap_column.datatype,
                )
                col_data_length = 1 if col_data_length is None else col_data_length
                om_column = Column(
                    name=ColumnName(
                        root=column_name
                        # Passing whitespace if column name is an empty string
                        # since pydantic doesn't accept empty string
                        if column_name
                        else " "
                    ),
                    displayName=sap_column.scrtext_l
                    if sap_column.scrtext_l
                    else sap_column.fieldname,
                    description=sap_column.i_ddtext,
                    dataType=column_type,
                    dataTypeDisplay=data_type_display,
                    ordinalPosition=int(sap_column.POS),
                    constraint=self._get_column_constraint(
                        column=sap_column, pk_columns=table_constraints_model.pk_columns
                    ),
                    dataLength=col_data_length,
                )
                if column_type == DataType.ARRAY.value:
                    om_column.arrayDataType = DataType.UNKNOWN
                if col_data_length and col_decimal_length:
                    om_column.precision = col_data_length
                    om_column.scale = col_decimal_length
                om_columns.append(om_column)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unable to get column details for {sap_column.fieldname}: {exc}"
                )
        return ColumnsAndConstraints(
            columns=om_columns,
            table_constraints=table_constraints_model.table_constraints,
        )

    # pylint: disable=arguments-renamed
    @calculate_execution_time_generator()
    def yield_table(self, table: SapErpTable) -> Iterable[Either[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        schema_name = self.context.get().database_schema
        try:

            columns_and_constraints = self.get_columns_and_constraints(
                table_name=table.tabname
            )

            table_request = CreateTableRequest(
                name=EntityName(table.tabname),
                tableType=TABLE_TYPE_MAP.get(table.tabclass, TableType.Regular),
                description=Markdown(table.ddtext),
                columns=columns_and_constraints.columns,
                tableConstraints=columns_and_constraints.table_constraints,
                databaseSchema=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=schema_name,
                    )
                ),
            )

            yield Either(right=table_request)

            # Register the request that we'll handle during the deletion checks
            self.register_record(table_request=table_request)

        except Exception as exc:
            error = f"Unexpected exception to yield table [{table.tabname}]: {exc}"
            yield Either(
                left=StackTraceError(
                    name=table.tabname, error=error, stackTrace=traceback.format_exc()
                )
            )

    def close(self):
        self.metadata.close()
