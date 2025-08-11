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
Generic call to handle table columns for sql connectors.
"""
import re
import traceback
from typing import Dict, List, Optional, Tuple

from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    Constraint,
    ConstraintType,
    DataType,
    TableConstraint,
    TableType,
)
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.utils.execution_time_tracker import calculate_execution_time
from metadata.utils.helpers import clean_up_starting_ending_double_quotes_in_string
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SqlColumnHandlerMixin:
    """
    Mixin class to handle sql source columns
    """

    def fetch_column_tags(  # pylint: disable=unused-argument
        self, column: dict, col_obj: Column
    ) -> None:
        if self.source_config.includeTags:
            logger.info("Fetching tags not implemented for this connector")
            self.source_config.includeTags = False

    def process_additional_table_constraints(
        self, column: dict, table_constraints: List[TableConstraint]
    ) -> None:
        """
        By Default there are no additional table constraints
        """

    def _get_display_datatype(
        self,
        data_type_display: str,
        col_type: str,
        col_data_length: str,
        arr_data_type: str,
        precision: Optional[Tuple[str, str]],
    ) -> str:
        if precision:
            return (
                data_type_display
                if data_type_display
                else f"{col_type}({precision[0]},{precision[1]})"
            )
        data_type_display = (
            f"{data_type_display}"
            if data_type_display
            else f"{col_type}({col_data_length})"
            if col_data_length
            else col_type
        )
        if col_type == "ARRAY":
            if arr_data_type is None:
                arr_data_type = DataType.UNKNOWN.value
            data_type_display = f"array<{arr_data_type}>"
        return data_type_display

    def _process_col_type(self, column: dict, schema: str) -> Tuple:
        data_type_display = None
        arr_data_type = None
        parsed_string = None
        if column.get("system_data_type") and column.get("is_complex"):
            column["system_data_type"] = self.clean_raw_data_type(
                column["system_data_type"]
            )
            if not column["system_data_type"].startswith(schema):
                parsed_string = ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
                    column["system_data_type"]
                )
                parsed_string["name"] = column["name"]
        else:
            col_type = ColumnTypeParser.get_column_type(column["type"])
            # For arrays, we'll get the item type if possible, or parse the string representation of the column
            # if SQLAlchemy does not provide any further information
            if col_type == "ARRAY" and getattr(column["type"], "item_type", None):
                arr_data_type = ColumnTypeParser.get_column_type(
                    column["type"].item_type
                )
            if col_type == "ARRAY" and re.match(
                r"(?:\w*)(?:\()(\w*)(?:.*)", str(column["type"])
            ):
                arr_data_type = re.match(
                    r"(?:\w*)(?:[(]*)(\w*)(?:.*)", str(column["type"])
                ).groups()
                if isinstance(arr_data_type, (list, tuple)):
                    arr_data_type = ColumnTypeParser.get_column_type(arr_data_type[0])
                data_type_display = column["type"]
            if col_type == DataType.ARRAY.value and not arr_data_type:
                arr_data_type = DataType.UNKNOWN.value
            data_type_display = data_type_display or column.get("display_type")
        return data_type_display, arr_data_type, parsed_string

    @staticmethod
    def _get_columns_with_constraints(
        schema_name: str, table_name: str, inspector: Inspector
    ) -> Tuple[List, List, List]:
        pk_constraints = inspector.get_pk_constraint(table_name, schema_name)
        try:
            unique_constraints = inspector.get_unique_constraints(
                table_name, schema_name
            )
        except NotImplementedError:
            logger.debug(
                f"Cannot obtain unique constraints for table [{schema_name}.{table_name}]: NotImplementedError"
            )
            unique_constraints = []
        try:
            foreign_constraints = inspector.get_foreign_keys(table_name, schema_name)
        except NotImplementedError:
            logger.debug(
                "Cannot obtain foreign constraints for table [{schema_name}.{table_name}]: NotImplementedError"
            )
            foreign_constraints = []

        pk_columns = (
            pk_constraints.get("constrained_columns")
            if len(pk_constraints) > 0 and pk_constraints.get("constrained_columns")
            else {}
        )

        foreign_columns = []
        for foreign_constraint in foreign_constraints:
            if len(foreign_constraint) > 0 and foreign_constraint.get(
                "constrained_columns"
            ):
                foreign_constraint.update(
                    {
                        "constrained_columns": [
                            clean_up_starting_ending_double_quotes_in_string(column)
                            for column in foreign_constraint.get("constrained_columns")
                        ],
                        "referred_columns": [
                            clean_up_starting_ending_double_quotes_in_string(column)
                            for column in foreign_constraint.get("referred_columns")
                        ],
                    }
                )
                foreign_columns.append(foreign_constraint)

        unique_columns = []
        for constraint in unique_constraints:
            if constraint.get("column_names"):
                unique_columns.append(
                    [
                        clean_up_starting_ending_double_quotes_in_string(column)
                        for column in constraint.get("column_names")
                    ]
                )

        pk_columns = [
            clean_up_starting_ending_double_quotes_in_string(pk_column)
            for pk_column in pk_columns
        ]

        return pk_columns, unique_columns, foreign_columns

    def _process_complex_col_type(self, parsed_string: dict, column: dict) -> Column:
        parsed_string["dataLength"] = self._check_col_length(
            parsed_string["dataType"], column["type"]
        )
        parsed_string["description"] = column.get("comment")
        if column["system_data_type"] == "array":
            array_data_type_display = (
                repr(column["type"])
                .replace("(", "<")
                .replace(")", ">")
                .replace("=", ":")
                .replace("<>", "")
                .lower()
            )
            parsed_string["dataTypeDisplay"] = f"{array_data_type_display}"
            parsed_string[
                "arrayDataType"
            ] = ColumnTypeParser._parse_primitive_datatype_string(  # pylint: disable=protected-access
                array_data_type_display[6:-1]
            )[
                "dataType"
            ]
        return Column(**parsed_string)

    def _get_columns_internal(
        self,
        schema_name: str,
        table_name: str,
        db_name: str,
        inspector: Inspector,
        table_type: TableType = None,
    ):
        """
        Get columns list
        """

        return inspector.get_columns(
            table_name, schema_name, table_type=table_type, db_name=db_name
        )

    @calculate_execution_time()
    def get_columns_and_constraints(  # pylint: disable=too-many-locals
        self,
        schema_name: str,
        table_name: str,
        db_name: str,
        inspector: Inspector,
        table_type: TableType = None,
    ) -> Tuple[
        Optional[List[Column]], Optional[List[TableConstraint]], Optional[List[Dict]]
    ]:
        """
        Get columns types and constraints information
        """

        table_constraints = []

        # Get inspector information:
        (
            pk_columns,
            unique_columns,
            foreign_columns,
        ) = self._get_columns_with_constraints(schema_name, table_name, inspector)

        column_level_unique_constraints = set()
        for col in unique_columns:
            if len(col) == 1:
                column_level_unique_constraints.add(col[0])
            else:
                if not any(
                    tc.constraintType == ConstraintType.UNIQUE and tc.columns == col
                    for tc in table_constraints
                ):
                    table_constraints.append(
                        TableConstraint(
                            constraintType=ConstraintType.UNIQUE,
                            columns=col,
                        )
                    )
        if len(pk_columns) > 1:
            table_constraints.append(
                TableConstraint(
                    constraintType=ConstraintType.PRIMARY_KEY,
                    columns=pk_columns,
                )
            )

        table_columns = []

        columns = self._get_columns_internal(
            schema_name, table_name, db_name, inspector, table_type
        )

        def process_column(column: dict):
            (
                data_type_display,
                arr_data_type,
                parsed_string,
            ) = self._process_col_type(column, schema_name)
            self.process_additional_table_constraints(
                column=column, table_constraints=table_constraints
            )
            if parsed_string is None:
                col_type = ColumnTypeParser.get_column_type(column["type"])
                col_constraint = self._get_column_constraints(
                    column, pk_columns, column_level_unique_constraints
                )
                col_data_length = self._check_col_length(col_type, column["type"])
                precision = ColumnTypeParser.check_col_precision(
                    col_type, column["type"]
                )
                if col_type is None:
                    col_type = DataType.UNKNOWN.name
                    data_type_display = col_type.lower()
                    logger.warning(
                        f"Unknown type {repr(column['type'])}: {column['name']}"
                    )
                data_type_display = self._get_display_datatype(
                    data_type_display,
                    col_type,
                    col_data_length,
                    arr_data_type,
                    precision,
                )
                col_data_length = 1 if col_data_length is None else col_data_length

                om_column = Column(
                    name=ColumnName(
                        root=(
                            column["name"]
                            # Passing whitespace if column name is an empty string
                            # since pydantic doesn't accept empty string
                            if column["name"]
                            else " "
                        )
                    ),
                    description=column.get("comment"),
                    dataType=col_type,
                    dataTypeDisplay=column.get("system_data_type", data_type_display),
                    dataLength=col_data_length,
                    constraint=col_constraint,
                    arrayDataType=arr_data_type,
                    ordinalPosition=column.get("ordinalPosition"),
                )
                if precision:
                    # Precision and scale must be integer values
                    om_column.precision = int(precision[0])
                    om_column.scale = int(precision[1])
            else:
                col_obj = self._process_complex_col_type(
                    column=column, parsed_string=parsed_string
                )
                om_column = col_obj

                if column.get("children"):
                    # Prioritize source-provided children for column processing.
                    # If 'children' are directly provided in the source metadata,
                    # process and assign them to the output column, overriding any derived children.
                    # Currently, this is only used for BigQuery.
                    om_column.children = [
                        process_column(children) for children in column.get("children")
                    ]
            om_column.tags = self.get_column_tag_labels(
                table_name=table_name, column=column
            )
            return om_column

        for column in columns:
            try:
                om_column = process_column(column)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unexpected exception processing column [{column}]: {exc}"
                )
                continue
            table_columns.append(om_column)
        return table_columns, table_constraints, foreign_columns

    @staticmethod
    def _check_col_length(datatype: str, col_raw_type: object):
        if datatype and datatype.upper() in {"CHAR", "VARCHAR", "BINARY", "VARBINARY"}:
            try:
                return col_raw_type.length if col_raw_type.length else 1
            except AttributeError:
                return 1
            return 1
        return None

    @staticmethod
    def _get_column_constraints(
        column, pk_columns, unique_columns
    ) -> Optional[Constraint]:
        """
        Prepare column constraints for the Table Entity
        """
        constraint = None
        if column["nullable"]:
            constraint = Constraint.NULL
        elif not column["nullable"]:
            constraint = Constraint.NOT_NULL

        if column["name"] in pk_columns:
            if len(pk_columns) > 1:
                return None
            constraint = Constraint.PRIMARY_KEY
        elif column["name"] in unique_columns:
            constraint = Constraint.UNIQUE
        return constraint

    def clean_raw_data_type(self, raw_data_type):
        return raw_data_type
