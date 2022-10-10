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
"""Clickhouse source module"""

import re

from pyhive.sqlalchemy_hive import _type_map
from sqlalchemy import types, util
from sqlalchemy.engine import reflection
from sqlalchemy.sql.sqltypes import String
from sqlalchemy_databricks._dialect import DatabricksDialect

from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService


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
    table_columns = self._get_table_columns(  # pylint: disable=protected-access
        connection, table_name, schema
    )
    column_rows = [
        [col.strip() if col else None for col in row] for row in table_columns
    ]
    # Filter out empty rows and comment
    return [row for row in column_rows if row[0] and row[0] != "# col_name"]


@reflection.cache
def get_columns(self, connection, table_name, schema=None, **kw):
    """
    This function overrides the sqlalchemy_databricks._dialect.DatabricksDialect.get_columns
    to add support for struct, array & map datatype

    Extract the Database Name from the keyword arguments parameter if it is present. This
    value should match what is provided in the 'source.config.database' field in the
    Databricks ingest config file.
    """
    db_name = kw["db_name"] if "db_name" in kw else None

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
            util.warn(f"Did not recognize type '{col_type}' of column '{col_name}'")
            coltype = types.NullType

        col_info = {
            "name": col_name,
            "type": coltype,
            "nullable": True,
            "default": None,
            "comment": _comment,
        }
        if col_type in {"array", "struct", "map"}:
            if db_name is not None:
                rows = dict(
                    connection.execute(
                        f"DESCRIBE {db_name}.{table_name} {col_name}"
                    ).fetchall()
                )
            else:
                rows = dict(
                    connection.execute(f"DESCRIBE {table_name} {col_name}").fetchall()
                )

            col_info["raw_data_type"] = rows["data_type"]
        result.append(col_info)
    return result


DatabricksDialect.get_columns = get_columns


class DatabricksSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Databricks Source
    """

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: DatabricksConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, DatabricksConnection):
            raise InvalidSourceException(
                f"Expected DatabricksConnection, but got {connection}"
            )
        return cls(config, metadata_config)
