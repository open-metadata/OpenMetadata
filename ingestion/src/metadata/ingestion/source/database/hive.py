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
Hive source methods.
"""

import re
from typing import Tuple

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


def get_columns(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument,too-many-locals
    """
    Method to handle table columns
    """
    rows = self._get_table_columns(  # pylint: disable=protected-access
        connection, table_name, schema
    )
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
            util.warn(f"Did not recognize type '{col_type}' of column '{col_name}'")
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


def get_table_names_older_versions(
    self, connection, schema=None, **kw
):  # pylint: disable=unused-argument
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
    return tables


def get_table_names(
    self, connection, schema=None, **kw
):  # pylint: disable=unused-argument
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
    # "SHOW TABLES" command in hive also fetches view names
    # Below code filters out view names from table names
    views = self.get_view_names(connection, schema)
    return [table for table in tables if table not in views]


def get_view_names(
    self, connection, schema=None, **kw
):  # pylint: disable=unused-argument
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


def get_view_names_older_versions(
    self, connection, schema=None, **kw
):  # pylint: disable=unused-argument
    # Hive does not provide functionality to query tableType for older version
    # This allows reflection to not crash at the cost of being inaccurate
    return []


HiveDialect.get_columns = get_columns


HIVE_VERSION_WITH_VIEW_SUPPORT = "2.2.0"


class HiveSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Hive Source
    """

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: HiveConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, HiveConnection):
            raise InvalidSourceException(
                f"Expected HiveConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def _parse_version(self, version: str) -> Tuple:
        return tuple(map(int, (version.split("."))))

    def prepare(self):
        """
        Based on the version of hive update the get_table_names method
        Fetching views in hive server with query "SHOW VIEWS" was possible
        only after hive 2.2.0 version
        """
        result = dict(self.engine.execute("SELECT VERSION()").fetchone())
        version = result.get("_c0", "").split()
        if version and self._parse_version(version[0]) >= self._parse_version(
            HIVE_VERSION_WITH_VIEW_SUPPORT
        ):
            HiveDialect.get_table_names = get_table_names
            HiveDialect.get_view_names = get_view_names
        else:
            HiveDialect.get_table_names = get_table_names_older_versions
            HiveDialect.get_view_names = get_view_names_older_versions
