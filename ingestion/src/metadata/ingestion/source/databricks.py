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
from typing import Optional

from pyhive.sqlalchemy_hive import _type_map
from sqlalchemy import types, util
from sqlalchemy.engine import reflection
from sqlalchemy.sql.sqltypes import String
from sqlalchemy_databricks._dialect import DatabricksDialect

from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLSource
from metadata.ingestion.source.sql_source_common import SQLConnectionConfig


class STRUCT(String):
    """The SQL STRUCT type."""

    __visit_name__ = "STRUCT"


class ARRAY(String):
    """The SQL ARRAY type."""

    __visit_name__ = "ARRAY"


class MAP(String):
    """The SQL MAP type."""

    __visit_name__ = "MAP"


_type_map.update({"struct": STRUCT, "array": ARRAY, "map": MAP})


@reflection.cache
def get_columns(self, connection, table_name, schema=None, **kw):
    # override to get columns properly; the reason is because databricks
    # presents the partition information differently from oss hive
    rows = self._get_table_columns(connection, table_name, schema)
    # Strip whitespace
    rows = [[col.strip() if col else None for col in row] for row in rows]
    # Filter out empty rows and comment
    rows = [row for row in rows if row[0] and row[0] != "# col_name"]
    result = []
    for (col_name, col_type, _comment) in rows:
        # Handle both oss hive and Databricks' hive partition header, respectively
        if col_name in ("# Partition Information", "# Partitioning"):
            break
        # Take out the more detailed type information
        # e.g. 'map<ixnt,int>' -> 'map'
        #      'decimal(10,1)' -> decimal
        raw_data_type = col_type
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
        }
        if col_type in ["array", "struct", "map"]:
            col_info["raw_data_type"] = raw_data_type
        result.append(col_info)
    return result


DatabricksDialect.get_columns = get_columns


class DatabricksConfig(SQLConnectionConfig):
    host_port: str
    scheme = "databricks+connector"
    service_type = DatabaseServiceType.Databricks.value
    token: str
    database: Optional[str]

    def get_connection_url(self):
        url = f"{self.scheme}://token:{self.token}@{self.host_port}"
        if self.database:
            url += f"/{self.database}"
        return url


class DatabricksSource(SQLSource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = DatabricksConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)
