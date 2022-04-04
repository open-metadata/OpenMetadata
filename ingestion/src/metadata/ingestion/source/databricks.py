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

from pyhive.sqlalchemy_hive import _type_map
from sqlalchemy import types, util
from sqlalchemy.engine import reflection
from sqlalchemy.sql.sqltypes import String
from sqlalchemy_databricks._dialect import DatabricksDialect

from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLSource
from metadata.ingestion.source.sql_source_common import SQLConnectionConfig


class STRUCT(String):
    #  This class is added to support STRUCT datatype
    """The SQL STRUCT type."""

    __visit_name__ = "STRUCT"


class ARRAY(String):
    #  This class is added to support ARRAY datatype
    """The SQL ARRAY type."""

    __visit_name__ = "ARRAY"


class MAP(String):
    #  This class is added to support MAP datatype
    """The SQL MAP type."""

    __visit_name__ = "MAP"


# overriding pyhive.sqlalchemy_hive._type_map
# mapping struct, array & map to custom classed instead of sqltypes.String
_type_map.update({"struct": STRUCT, "array": ARRAY, "map": MAP})


def _get_column_rows(self, connection, table_name, schema):
    # get columns and strip whitespace
    table_columns = self._get_table_columns(connection, table_name, schema)
    column_rows = [
        [col.strip() if col else None for col in row] for row in table_columns
    ]
    # Filter out empty rows and comment
    return [row for row in column_rows if row[0] and row[0] != "# col_name"]


@reflection.cache
def get_columns(self, connection, table_name, schema=None, **kw):
    # This function overrides the sqlalchemy_databricks._dialect.DatabricksDialect.get_columns
    # to add support for struct, array & map datatype
    rows = _get_column_rows(self, connection, table_name, schema)
    result = []
    for (col_name, col_type, _comment) in rows:
        # Handle both oss hive and Databricks' hive partition header, respectively
        if col_name in ("# Partition Information", "# Partitioning"):
            break
        # Take out the more detailed type information
        # e.g. 'map<ixnt,int>' -> 'map'
        #      'decimal(10,1)' -> decimal
        col_type = re.search(r"^\w+", col_type).group(0)
        try:
            coltype = _type_map[col_type]
        except KeyError:
            util.warn(
                "Did not recognize type '%s' of column '%s'" % (col_type, col_name)
            )
            coltype = types.NullType

        col_info = {
            "name": col_name,
            "type": coltype,
            "nullable": True,
            "default": None,
            "comment": _comment,
        }
        if col_type in {"array", "struct", "map"}:
            rows = dict(
                connection.execute(
                    "DESCRIBE {} {}".format(table_name, col_name)
                ).fetchall()
            )
            col_info["raw_data_type"] = rows["data_type"]
        result.append(col_info)
    return result


DatabricksDialect.get_columns = get_columns

from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)


class DatabricksConfig(DatabricksConnection, SQLConnectionConfig):
    def get_connection_url(self):
        url = f"{self.scheme}://token:{self.token}@{self.hostPort}"
        if self.database:
            url += f"/{self.database}"
        return url


class DatabricksSource(SQLSource):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config_dict):
        config = DatabricksConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config)
