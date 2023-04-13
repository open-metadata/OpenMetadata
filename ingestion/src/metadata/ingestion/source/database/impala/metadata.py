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
Impala source methods.
"""

import re
from typing import Tuple

from impala.sqlalchemy import ImpalaDialect, _impala_type_to_sqlalchemy_type
from pyhive.sqlalchemy_hive import _type_map

from sqlalchemy import types, util
from sqlalchemy.engine import reflection

from metadata.generated.schema.entity.services.connections.database.impalaConnection import (
    ImpalaConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.hive.queries import HIVE_GET_COMMENTS
from metadata.profiler.orm.registry import Dialects

complex_data_types = ["struct", "map", "array", "union"]

_type_map.update(
    {
        "binary": types.BINARY,
        "char": types.CHAR,
        "varchar": types.VARCHAR,
    }
)


def get_impala_table_or_view_names(connection, schema=None, target_type="table"):
    """
    Depending on the targetType returns either the Views or Tables
    since they share the same method for getting their names.
    """
    query = "show tables"
    if schema:
        query += " IN " + schema

    cursor = connection.execute(query)
    results = cursor.fetchall()
    tables_and_views = [result[0] for result in results]

    retvalue = []

    for table_view in tables_and_views:
        query = f"describe formatted `{schema}`.`{table_view}`"
        cursor = connection.execute(query)
        results = cursor.fetchall()

        for result in list(results):
            data = result
            if data[0].strip() == "Table Type:":
                if target_type.lower() in data[1].lower():
                    retvalue.append(table_view)
    return retvalue


def get_view_names(
    self, connection, schema=None, **kw
):  # pylint: disable=unused-argument
    results = get_impala_table_or_view_names(connection, schema, "view")
    return results


def get_table_names(
    self, connection, schema=None, **kw
):  # pylint: disable=unused-argument
    results = get_impala_table_or_view_names(connection, schema, "table")
    return results

@reflection.cache
def get_table_comment(
    self, connection, table_name, schema_name, **kw
):  # pylint: disable=unused-argument
    """
    Gets the table comment from the describe formatted query result under the Table Parameters section.
    """
    full_table_name = (
        f"{schema_name}.{table_name}" if schema_name is not None else table_name
    )
    split_name = full_table_name.split(".")
    query = f"describe formatted `{split_name[0]}`.`{split_name[1]}`"
    cursor = connection.execute(query)
    results = cursor.fetchall()

    found_table_parameters = False
    try:
        for result in list(results):
            data = result
            if not found_table_parameters and data[0].strip() == "Table Parameters:":
                found_table_parameters = True
            if found_table_parameters:
                coltext = data[1].strip() if data[1] is not None else ""
                if coltext == "comment":
                    return {"text": data[2]}
    except Exception:
        return {"text": None}
    return {"text": None}


def get_columns(
    self, connection, table_name, schema=None, **kwargs
):  # pylint: disable=unused-argument
    # pylint: disable=too-many-locals
    """
    Extracted from the Impala Dialect. We'll tune the implementation.

    By default, this gives us the column name as `table.column`. We just
    want to get `column`.
    """
    full_table_name = f"{schema}.{table_name}" if schema is not None else table_name
    split_name = full_table_name.split(".")
    query = f"DESCRIBE `{split_name[0]}`.`{split_name[1]}`"
    describe_table_rows = connection.execute(query)
    column_info = []
    ordinal_pos = 0
    for col in describe_table_rows:
        ordinal_pos = ordinal_pos + 1
        col_raw = col[1]
        attype = re.sub(r"\(.*\)", "", col[1])
        col_type = re.search(r"^\w+", col[1]).group(0)
        try:
            coltype = _type_map[col_type]
        except KeyError:
            util.warn(f"Did not recognize type '{col_raw}' of column '{col[0]}'")
            coltype = types.NullType
        charlen = re.search(r"\(([\d,]+)\)", col_raw.lower())
        if charlen:
            charlen = charlen.group(1)
            if attype == "decimal":
                prec, scale = charlen.split(",")
                args = (int(prec), int(scale))
            else:
                args = (int(charlen),)
            coltype = coltype(*args)
        add_column = {
            "name": col[0],
            "type": coltype,
            "comment": col[2],
            "nullable": True,
            "autoincrement": False,
            "ordinalPosition": ordinal_pos,
        }
        column_info.append(add_column)
    return column_info


class ImpalaSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Hive Source
    """

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: ImpalaConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, ImpalaConnection):
            raise InvalidSourceException(
                f"Expected ImpalaConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        ImpalaDialect.get_table_names = get_table_names
        ImpalaDialect.get_view_names = get_view_names
        ImpalaDialect.get_table_comment = get_table_comment
        ImpalaDialect.get_columns = get_columns
        
