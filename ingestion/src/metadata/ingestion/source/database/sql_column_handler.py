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
Generic call to handle table columns for sql connectors.
"""
import re
import traceback
from typing import List, Optional, Tuple

from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    ConstraintType,
    DataType,
    TableConstraint,
)
from metadata.utils.column_type_parser import ColumnTypeParser
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SqlColumnHandlerMixin:
    def fetch_column_tags(self, column: dict, col_obj: Column) -> None:
        if self.source_config.includeTags:
            logger.info("Fetching tags not implemeneted for this connector")
            self.source_config.includeTags = False

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
        dataTypeDisplay = (
            f"{data_type_display}"
            if data_type_display
            else "{}({})".format(col_type, col_data_length)
            if col_data_length
            else col_type
        )
        if col_type == "ARRAY":
            if arr_data_type is None:
                arr_data_type = DataType.VARCHAR.value
            dataTypeDisplay = f"array<{arr_data_type}>"
        return dataTypeDisplay

    def _process_col_type(self, column: dict, schema: str) -> Tuple:
        data_type_display = None
        arr_data_type = None
        parsed_string = None
        if "raw_data_type" in column and column["raw_data_type"] is not None:
            column["raw_data_type"] = self.parse_raw_data_type(column["raw_data_type"])
            if not column["raw_data_type"].startswith(schema):
                parsed_string = ColumnTypeParser._parse_datatype_string(
                    column["raw_data_type"]
                )
                parsed_string["name"] = column["name"]
        else:
            col_type = ColumnTypeParser.get_column_type(column["type"])
            if col_type == "ARRAY" and re.match(
                r"(?:\w*)(?:\()(\w*)(?:.*)", str(column["type"])
            ):
                arr_data_type = re.match(
                    r"(?:\w*)(?:[(]*)(\w*)(?:.*)", str(column["type"])
                ).groups()
                if isinstance(arr_data_type, list) or isinstance(arr_data_type, tuple):
                    arr_data_type = ColumnTypeParser.get_column_type(arr_data_type[0])
                data_type_display = column["type"]
            if col_type == DataType.ARRAY.value and not arr_data_type:
                arr_data_type = DataType.VARCHAR.value
        return data_type_display, arr_data_type, parsed_string

    @staticmethod
    def _get_columns_with_constraints(
        schema_name: str, table_name: str, inspector: Inspector
    ) -> Tuple[List, List]:
        pk_constraints = inspector.get_pk_constraint(table_name, schema_name)
        try:
            unique_constraints = inspector.get_unique_constraints(
                table_name, schema_name
            )
        except NotImplementedError:
            logger.warning("Cannot obtain unique constraints - NotImplementedError")
            unique_constraints = []
        try:
            foreign_constraints = inspector.get_foreign_keys(table_name, schema_name)
        except NotImplementedError:
            logger.warning("Cannot obtain foreign constraints - NotImplementedError")
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
                foreign_columns.extend(foreign_constraint.get("constrained_columns"))

        unique_columns = []
        for constraint in unique_constraints:
            if constraint.get("column_names"):
                unique_columns.extend(constraint.get("column_names"))
        return pk_columns, unique_columns, foreign_columns

    def _process_complex_col_type(self, parsed_string: dict, column: dict) -> Column:
        parsed_string["dataLength"] = self._check_col_length(
            parsed_string["dataType"], column["type"]
        )
        parsed_string["description"] = column.get("comment")
        if column["raw_data_type"] == "array":
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
            ] = ColumnTypeParser._parse_primitive_datatype_string(
                array_data_type_display[6:-1]
            )[
                "dataType"
            ]
        return Column(**parsed_string)

    def get_columns_and_constraints(
        self, schema_name: str, table_name: str, db_name: str, inspector: Inspector
    ) -> Tuple[Optional[List[Column]], Optional[List[TableConstraint]]]:
        """
        Get columns types and constraints information
        """
        # Get inspector information:
        (
            pk_columns,
            unique_columns,
            foreign_columns,
        ) = self._get_columns_with_constraints(schema_name, table_name, inspector)
        table_columns = []
        table_constraints = []
        if foreign_columns:
            table_constraints.append(
                TableConstraint(
                    constraintType=ConstraintType.FOREIGN_KEY,
                    columns=foreign_columns,
                )
            )
        columns = inspector.get_columns(table_name, schema_name, db_name=db_name)
        for column in columns:
            try:
                children = None
                (
                    data_type_display,
                    arr_data_type,
                    parsed_string,
                ) = self._process_col_type(column, schema_name)
                if parsed_string is None:
                    col_type = ColumnTypeParser.get_column_type(column["type"])
                    col_constraint = self._get_column_constraints(
                        column, pk_columns, unique_columns
                    )
                    if not col_constraint and len(pk_columns) > 1:
                        table_constraints.append(
                            TableConstraint(
                                constraintType=ConstraintType.PRIMARY_KEY,
                                columns=pk_columns,
                            )
                        )
                    col_data_length = self._check_col_length(col_type, column["type"])
                    precision = ColumnTypeParser.check_col_precision(
                        col_type, column["type"]
                    )
                    if col_type == "NULL" or col_type is None:
                        col_type = DataType.VARCHAR.name
                        data_type_display = col_type.lower()
                        logger.warning(
                            "Unknown type {} mapped to VARCHAR: {}".format(
                                repr(column["type"]), column["name"]
                            )
                        )
                    dataTypeDisplay = self._get_display_datatype(
                        data_type_display,
                        col_type,
                        col_data_length,
                        arr_data_type,
                        precision,
                    )
                    col_data_length = 1 if col_data_length is None else col_data_length
                    om_column = Column(
                        name=column["name"]
                        if column["name"]
                        else " ",  # Passing whitespace if column name is an empty string since pydantic doesn't accept empty string
                        description=column.get("comment", None),
                        dataType=col_type,
                        dataTypeDisplay=dataTypeDisplay,
                        dataLength=col_data_length,
                        constraint=col_constraint,
                        children=children,
                        arrayDataType=arr_data_type,
                    )
                    if precision:
                        om_column.precision = precision[0]
                        om_column.scale = precision[1]

                else:
                    col_obj = self._process_complex_col_type(
                        column=column, parsed_string=parsed_string
                    )
                    om_column = col_obj
                om_column.tags = self.get_column_tag_labels(
                    table_name=table_name, column=column
                )
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(f"{err} : {column}")
                continue
            table_columns.append(om_column)
        return table_columns, table_constraints

    @staticmethod
    def _check_col_length(datatype: str, col_raw_type: object):
        if datatype and datatype.upper() in {"CHAR", "VARCHAR", "BINARY", "VARBINARY"}:
            try:
                return col_raw_type.length if col_raw_type.length else 1
            except AttributeError:
                return 1

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

    def parse_raw_data_type(self, raw_data_type):
        return raw_data_type
