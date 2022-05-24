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


class SqlColumnHandler:
    def fetch_tags(self, column: dict, col_obj: Column) -> None:
        if self.source_config.includeTags:
            logger.info("Fetching tags not implemeneted for this connector")
            self.source_config.includeTags = False

    def _get_display_datatype(
        self,
        data_type_display: str,
        col_type: str,
        col_data_length: str,
        arr_data_type: str,
    ) -> str:
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
        return data_type_display, arr_data_type, parsed_string

    def _get_columns_with_constraints(
        self, schema: str, table: str, inspector: Inspector
    ) -> Tuple[List]:
        pk_constraints = inspector.get_pk_constraint(table, schema)
        try:
            unique_constraints = inspector.get_unique_constraints(table, schema)
        except NotImplementedError:
            logger.warning("Cannot obtain unique constraints - NotImplementedError")
            unique_constraints = []

        pk_columns = (
            pk_constraints.get("constrained_columns")
            if len(pk_constraints) > 0 and pk_constraints.get("constrained_columns")
            else {}
        )

        unique_columns = []
        for constraint in unique_constraints:
            if constraint.get("column_names"):
                unique_columns.extend(constraint.get("column_names"))
        return pk_columns, unique_columns

    def _process_complex_col_type(self, parsed_string: dict, column: dict) -> Column:
        parsed_string["dataLength"] = self._check_col_length(
            parsed_string["dataType"], column["type"]
        )
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

    def get_columns(
        self, schema: str, table: str, inspector: Inspector
    ) -> Optional[List[Column]]:
        """
        Get columns types and constraints information
        """
        # Get inspector information:
        pk_columns, unique_columns = self._get_columns_with_constraints(
            schema, table, inspector
        )
        table_columns = []
        columns = inspector.get_columns(
            table, schema, db_name=self.service_connection.database
        )
        for column in columns:
            try:
                children = None
                (
                    data_type_display,
                    arr_data_type,
                    parsed_string,
                ) = self._process_col_type(column, schema)
                if parsed_string is None:
                    col_type = ColumnTypeParser.get_column_type(column["type"])
                    col_constraint = self._get_column_constraints(
                        column, pk_columns, unique_columns
                    )
                    if not col_constraint and len(pk_columns) > 1:
                        self.table_constraints = [
                            TableConstraint(
                                constraintType=ConstraintType.PRIMARY_KEY,
                                columns=pk_columns,
                            )
                        ]
                    col_data_length = self._check_col_length(col_type, column["type"])
                    if col_type == "NULL" or col_type is None:
                        col_type = DataType.VARCHAR.name
                        data_type_display = col_type.lower()
                        logger.warning(
                            "Unknown type {} mapped to VARCHAR: {}".format(
                                repr(column["type"]), column["name"]
                            )
                        )
                    dataTypeDisplay = self._get_display_datatype(
                        data_type_display, col_type, col_data_length, arr_data_type
                    )
                    col_data_length = 1 if col_data_length is None else col_data_length

                    om_column = Column(
                        name=column["name"],
                        description=column.get("comment", None),
                        dataType=col_type,
                        dataTypeDisplay=dataTypeDisplay,
                        dataLength=col_data_length,
                        constraint=col_constraint,
                        children=children,
                        arrayDataType=arr_data_type,
                    )
                else:
                    col_obj = self._process_complex_col_type(
                        column=column, parsed_string=parsed_string
                    )
                    om_column = col_obj
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(f"{err} : {column}")
                continue
            self.fetch_tags(column=column, col_obj=om_column)
            table_columns.append(om_column)
        return table_columns

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
