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
Impala source methods.
"""

import re
from typing import Optional

from impala.sqlalchemy import ImpalaDialect, _impala_type_to_sqlalchemy_type
from sqlalchemy import types, util
from sqlalchemy.engine import reflection

from metadata.generated.schema.entity.services.connections.database.impalaConnection import (
    ImpalaConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.impala.queries import IMPALA_GET_COMMENTS

complex_data_types = ["struct", "map", "array", "union"]

_impala_type_to_sqlalchemy_type.update(
    {
        "CHAR": types.CHAR,
        "REAL": types.REAL,
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
    query = IMPALA_GET_COMMENTS.format(
        schema_name=split_name[0], table_name=split_name[1]
    )
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
            coltype = _impala_type_to_sqlalchemy_type[col_type.upper()]
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


# pylint: disable=unused-argument
@reflection.cache
def get_view_definition(self, connection, view_name, schema=None, **kw):
    """
    Gets the view definition
    """
    full_view_name = f"`{view_name}`" if not schema else f"`{schema}`.`{view_name}`"
    res = connection.execute(f"SHOW CREATE VIEW {full_view_name}").fetchall()
    if res:
        return "\n".join(i[0] for i in res)
    return None


class ImpalaSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Impala Source
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: ImpalaConnection = config.serviceConnection.root.config
        if not isinstance(connection, ImpalaConnection):
            raise InvalidSourceException(
                f"Expected ImpalaConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        ImpalaDialect.get_table_names = get_table_names
        ImpalaDialect.get_view_names = get_view_names
        ImpalaDialect.get_table_comment = get_table_comment
        ImpalaDialect.get_columns = get_columns
        ImpalaDialect.get_view_definition = get_view_definition
