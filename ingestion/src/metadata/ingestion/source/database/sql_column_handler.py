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
from typing import List, Optional

from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.api.tags.createTag import CreateTagRequest
from metadata.generated.schema.entity.data.table import (
    Column,
    ConstraintType,
    DataType,
    TableConstraint,
)
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.utils import ometa_logger
from metadata.utils.column_type_parser import ColumnTypeParser
from metadata.utils.fqdn_generator import get_fqdn

logger = ometa_logger()


class SqlColumnHandler:
    def fetch_tags(self, schema: str, table_name: str, column_name: str = ""):
        return []

    # TODO
    # BREAK DOWN THIS METHOD TO SMALLER CHUNKS
    def get_columns(
        self, schema: str, table: str, inspector: Inspector
    ) -> Optional[List[Column]]:
        """
        Get columns types and constraints information
        """

        # Get inspector information:
        pk_constraints = inspector.get_pk_constraint(table, schema)
        try:
            unique_constraints = inspector.get_unique_constraints(table, schema)
        except NotImplementedError:
            logger.warning("Cannot obtain constraints - NotImplementedError")
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

        table_columns = []
        columns = inspector.get_columns(
            table, schema, db_name=self.service_connection.database
        )
        try:
            for column in columns:
                try:
                    if "." in column["name"]:
                        column["name"] = column["name"]
                    children = None
                    data_type_display = None
                    arr_data_type = None
                    parsed_string = None
                    if (
                        "raw_data_type" in column
                        and column["raw_data_type"] is not None
                    ):

                        column["raw_data_type"] = self.parse_raw_data_type(
                            column["raw_data_type"]
                        )
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
                            if isinstance(arr_data_type, list) or isinstance(
                                arr_data_type, tuple
                            ):
                                arr_data_type = ColumnTypeParser.get_column_type(
                                    arr_data_type[0]
                                )
                            data_type_display = column["type"]
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
                        col_data_length = self._check_col_length(
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
                        dataTypeDisplay = (
                            f"{data_type_display}"
                            if data_type_display
                            else "{}({})".format(col_type, col_data_length)
                            if col_data_length
                            else col_type
                        )
                        col_data_length = (
                            1 if col_data_length is None else col_data_length
                        )
                        if col_type == "ARRAY":
                            if arr_data_type is None:
                                arr_data_type = DataType.VARCHAR.name
                            dataTypeDisplay = f"array<{arr_data_type}>"

                        om_column = Column(
                            name=column["name"],
                            description=column.get("comment", None),
                            dataType=col_type,
                            dataTypeDisplay=dataTypeDisplay,
                            dataLength=col_data_length,
                            constraint=col_constraint,
                            children=children if children else None,
                            arrayDataType=arr_data_type,
                        )
                        tag_category_list = self.fetch_tags(
                            schema=schema, table_name=table, column_name=column["name"]
                        )
                        om_column.tags = []
                        for tags in tag_category_list:
                            om_column.tags.append(
                                TagLabel(
                                    tagFQN=get_fqdn(
                                        Tag,
                                        tags.category_name.name.__root__,
                                        tags.category_details.name.__root__,
                                    ),
                                    labelType="Automated",
                                    state="Suggested",
                                    source="Tag",
                                )
                            )
                    else:
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
                            parsed_string[
                                "dataTypeDisplay"
                            ] = f"{array_data_type_display}"
                            parsed_string[
                                "arrayDataType"
                            ] = ColumnTypeParser._parse_primitive_datatype_string(
                                array_data_type_display[6:-1]
                            )[
                                "dataType"
                            ]
                        col_dict = Column(**parsed_string)
                        try:
                            if (
                                hasattr(self.config, "enable_policy_tags")
                                and "policy_tags" in column
                                and column["policy_tags"]
                            ):
                                self.metadata.create_primary_tag(
                                    category_name=self.service_connection.tagCategoryName,
                                    primary_tag_body=CreateTagRequest(
                                        name=column["policy_tags"],
                                        description="Bigquery Policy Tag",
                                    ),
                                )
                        except APIError:
                            if (
                                column["policy_tags"]
                                and self.service_connection.enablePolicyTagImport
                            ):
                                col_dict.tags = [
                                    TagLabel(
                                        tagFQN=get_fqdn(
                                            Tag,
                                            self.service_connection.tagCategoryName,
                                            column["policy_tags"],
                                        ),
                                        labelType="Automated",
                                        state="Suggested",
                                        source="Tag",
                                    )
                                ]
                        except Exception as err:
                            logger.debug(traceback.format_exc())
                            logger.error(err)

                        om_column = col_dict
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.error(f"{err} : {column}")
                    continue
                table_columns.append(om_column)
            return table_columns
        except Exception as err:
            logger.error(f"{repr(err)}: {table} {err}")
            return None

    @staticmethod
    def _check_col_length(datatype, col_raw_type):
        if datatype and datatype.upper() in {"CHAR", "VARCHAR", "BINARY", "VARBINARY"}:
            try:
                return col_raw_type.length if col_raw_type.length else 1
            except AttributeError:
                return 1

    def parse_raw_data_type(self, raw_data_type):
        return raw_data_type
