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
from metadata.utils.sqlalchemy_utils import is_complex_type


@reflection.cache
def _get_column_type(self, type_):
    """
    Function overwritten from AthenaDialect
    to add custom SQA typing.
    """
    type_ = type_.replace(" ", "").lower()
    match = self._pattern_column_type.match(type_)  # pylint: disable=protected-access
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


@reflection.cache
def get_columns(self, connection, table_name, schema=None, **kw):
    """
    Method to handle table columns
    """
    metadata = self._get_table(  # pylint: disable=protected-access
        connection, table_name, schema=schema, **kw
    )
    columns = [
        {
            "name": c.name,
            "type": self._get_column_type(c.type),  # pylint: disable=protected-access
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

    columns += [
        {
            "name": c.name,
            "type": self._get_column_type(c.type),  # pylint: disable=protected-access
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
