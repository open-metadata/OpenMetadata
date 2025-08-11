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

"""Athena utils module"""

from copy import deepcopy
from typing import Dict, List, Optional

from pyathena.sqlalchemy.util import _HashableDict
from sqlalchemy import types
from sqlalchemy.engine import reflection

from metadata.ingestion.source import sqa_types
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.utils.logger import utils_logger
from metadata.utils.sqlalchemy_utils import is_complex_type

logger = utils_logger()

# pylint: disable=protected-access
@reflection.cache
def _get_column_type(self, type_):
    """
    Function overwritten from AthenaDialect
    to add custom SQA typing.
    """
    type_ = type_.replace(" ", "").lower()
    match = self._pattern_column_type.match(type_)
    if match:
        name = match.group(1).lower()
        length = match.group(2)
    else:
        name = type_.lower()
        length = None

    args = []
    col_map = {
        "boolean": types.BOOLEAN,
        "float": types.FLOAT,
        "double": types.FLOAT,
        "real": types.FLOAT,
        "tinyint": types.INTEGER,
        "smallint": types.INTEGER,
        "integer": types.INTEGER,
        "int": types.INTEGER,
        "bigint": types.BIGINT,
        "string": types.String,
        "date": types.DATE,
        "timestamp": types.TIMESTAMP,
        "binary": types.BINARY,
        "varbinary": types.BINARY,
        "array": types.ARRAY,
        "json": types.JSON,
        "struct": sqa_types.SQAStruct,
        "row": sqa_types.SQAStruct,
        "map": sqa_types.SQAMap,
        "decimal": types.DECIMAL,
        "varchar": types.VARCHAR,
        "char": types.CHAR,
    }
    if name in ["decimal", "char", "varchar"]:
        col_type = col_map[name]
        if length:
            args = [int(l) for l in length.split(",")]
    elif type_.startswith("array"):
        parsed_type = (
            ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
                type_
            )
        )
        col_type = col_map["array"]
        if parsed_type["arrayDataType"].lower().startswith("array"):
            # as OpenMetadata doesn't store any details on children of array, we put
            # in type as string as default to avoid Array item_type required issue
            # from sqlalchemy types
            args = [types.String]
        else:
            args = [col_map.get(parsed_type.get("arrayDataType").lower(), types.String)]
    elif col_map.get(name):
        col_type = col_map.get(name)
    else:
        logger.warning(f"Did not recognize type '{type_}'")
        col_type = types.NullType
    return col_type(*args)


# pylint: disable=unused-argument
def _get_projection_details(
    columns: List[Dict], projection_parameters: Dict
) -> List[Dict]:
    """Get the projection details for the columns

    Args:
        columns (List[Dict]): list of columns
        projection_parameters (Dict): projection parameters
    """
    if not projection_parameters:
        return columns

    columns = deepcopy(columns)
    for col in columns:
        projection_details = next(
            ({k: v} for k, v in projection_parameters.items() if k == col["name"]), None
        )
        if projection_details:
            col["projection_type"] = projection_details[col["name"]]

    return columns


# pylint: disable=too-many-locals
@reflection.cache
def get_columns(self, connection, table_name, schema=None, **kw):
    """
    Method to handle table columns
    """
    metadata = self._get_table(connection, table_name, schema=schema, **kw)
    columns = [
        {
            "name": c.name,
            "type": self._get_column_type(c.type),
            "nullable": True,
            "default": None,
            "autoincrement": False,
            "comment": c.comment,
            "system_data_type": c.type,
            "is_complex": is_complex_type(c.type),
            "dialect_options": {"awsathena_partition": True},
        }
        for c in metadata.partition_keys
    ]

    if kw.get("only_partition_columns"):
        # Return projected partition information to set partition type in `get_table_partition_details`
        # projected partition fields are stored in the form of `projection.<field_name>.type` as a table parameter
        projection_parameters = {
            key_.split(".")[1]: value_
            for key_, value_ in metadata.parameters.items()
            if key_.startswith("projection") and key_.endswith("type")
        }
        columns = _get_projection_details(columns, projection_parameters)
        return columns

    # Check if this is an Iceberg table
    if metadata.parameters.get("table_type") == "ICEBERG":
        # For Iceberg tables, get the full table metadata from Glue to access column parameters
        try:
            # Get the raw connection to access schema information
            raw_connection = self._raw_connection(connection)
            schema = schema if schema else raw_connection.schema_name

            # Use the provided Glue client or create one with default credentials
            glue_client = kw.get("glue_client")

            # Get full table metadata from Glue
            response = glue_client.get_table(DatabaseName=schema, Name=table_name)

            table_info = response["Table"]

            # Filter out non-current Iceberg columns
            current_columns = []
            storage_descriptor = table_info.get("StorageDescriptor", {})
            glue_columns = storage_descriptor.get("Columns", [])

            for glue_col in glue_columns:
                col_name = glue_col["Name"]
                col_type = glue_col["Type"]
                col_comment = glue_col.get("Comment", "")
                col_parameters = glue_col.get("Parameters", {})

                # Check if this is a non-current Iceberg column
                iceberg_current = col_parameters.get("iceberg.field.current", "true")
                is_current = iceberg_current != "false"

                if is_current:
                    current_columns.append(
                        {
                            "name": col_name,
                            "type": self._get_column_type(col_type),
                            "nullable": True,
                            "default": None,
                            "autoincrement": False,
                            "comment": col_comment,
                            "system_data_type": col_type,
                            "is_complex": is_complex_type(col_type),
                            "dialect_options": {"awsathena_partition": None},
                        }
                    )

            columns += current_columns
            return columns

        except Exception as e:
            # If we can't get Glue metadata, fall back to the original method
            # This ensures backward compatibility
            logger.warning(f"Error getting Glue metadata for table {table_name}: {e}")

    # For non-Iceberg tables or if Glue access fails, use the original method
    columns += [
        {
            "name": c.name,
            "type": self._get_column_type(c.type),
            "nullable": True,
            "default": None,
            "autoincrement": False,
            "comment": c.comment,
            "system_data_type": c.type,
            "is_complex": is_complex_type(c.type),
            "dialect_options": {"awsathena_partition": None},
        }
        for c in metadata.columns
    ]

    return columns


@reflection.cache
def get_view_definition(self, connection, view_name, schema=None, **kw):
    """
    Gets the view definition
    """
    full_view_name = f'"{view_name}"' if not schema else f'"{schema}"."{view_name}"'
    res = connection.execute(f"SHOW CREATE VIEW {full_view_name}").fetchall()
    if res:
        return "\n".join(i[0] for i in res)
    return None


def get_table_options(
    self, connection: "Connection", table_name: str, schema: Optional[str] = None, **kw
):
    metadata = self._get_table(connection, table_name, schema=schema, **kw)
    return {
        "awsathena_location": metadata.location,
        "awsathena_compression": metadata.compression,
        "awsathena_row_format": metadata.row_format,
        "awsathena_file_format": metadata.file_format,
        "awsathena_serdeproperties": _HashableDict(metadata.serde_properties),
        "awsathena_tblproperties": _HashableDict(metadata.table_properties),
    }
