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

import re

from pyhive.sqlalchemy_hive import HiveDialect, _type_map
from sqlalchemy import types, util

from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService

complex_data_types = ["struct", "map", "array", "union"]

_type_map.update(
    {
        "binary": types.BINARY,
        "char": types.CHAR,
        "varchar": types.VARCHAR,
    }
)


def get_columns(self, connection, table_name, schema=None, **kw):
    rows = self._get_table_columns(connection, table_name, schema)
    rows = [[col.strip() if col else None for col in row] for row in rows]
    rows = [row for row in rows if row[0] and row[0] != "# col_name"]
    result = []
    args = ()
    for (col_name, col_type, comment) in rows:
        if col_name == "# Partition Information":
            break

        col_raw_type = col_type
        attype = re.sub(r"\(.*\)", "", col_type)
        col_type = re.search(r"^\w+", col_type).group(0)
        try:
            coltype = _type_map[col_type]

        except KeyError:
            util.warn(
                "Did not recognize type '%s' of column '%s'" % (col_type, col_name)
            )
            coltype = types.NullType
        charlen = re.search(r"\(([\d,]+)\)", col_raw_type.lower())
        if charlen:
            charlen = charlen.group(1)
            if attype == "decimal":
                prec, scale = charlen.split(",")
                args = (int(prec), int(scale))
            else:
                args = (int(charlen),)
            coltype = coltype(*args)

        result.append(
            {
                "name": col_name,
                "type": coltype,
                "comment": comment,
                "nullable": True,
                "default": None,
                "raw_data_type": col_raw_type
                if col_type in complex_data_types
                else None,
            }
        )
    return result


def get_table_names(self, connection, schema=None, **kw):
    query = "SHOW TABLES"
    if schema:
        query += " IN " + self.identifier_preparer.quote_identifier(schema)
    tables_in_schema = connection.execute(query)
    tables = []
    for row in tables_in_schema:
        # check number of columns in result
        # if it is > 1, we use spark thrift server with 3 columns in the result (schema, table, is_temporary)
        # else it is hive with 1 column in the result
        if len(row) > 1:
            tables.append(row[1])
        else:
            tables.append(row[0])
    views = get_view_names(self, connection, schema)
    return [table for table in tables if table not in views]


def get_view_names(self, connection, schema=None, **kw):
    query = "SHOW VIEWS"
    if schema:
        query += " IN " + self.identifier_preparer.quote_identifier(schema)
    view_in_schema = connection.execute(query)
    views = []
    for row in view_in_schema:
        # check number of columns in result
        # if it is > 1, we use spark thrift server with 3 columns in the result (schema, table, is_temporary)
        # else it is hive with 1 column in the result
        if len(row) > 1:
            views.append(row[1])
        else:
            views.append(row[0])
    return views


HiveDialect.get_columns = get_columns
HiveDialect.get_table_names = get_table_names
HiveDialect.get_view_names = get_view_names


class HiveSource(CommonDbSourceService):
    def prepare(self):
        return super().prepare()

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: HiveConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, HiveConnection):
            raise InvalidSourceException(
                f"Expected HiveConnection, but got {connection}"
            )
        return cls(config, metadata_config)
