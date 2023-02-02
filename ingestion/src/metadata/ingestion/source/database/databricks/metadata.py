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
import traceback
from copy import deepcopy
from typing import Iterable

from pyhive.sqlalchemy_hive import _type_map
from sqlalchemy import types, util
from sqlalchemy.engine import reflection
from sqlalchemy.inspection import inspect
from sqlalchemy.sql.sqltypes import String
from sqlalchemy_databricks._dialect import DatabricksDialect

from metadata.generated.schema.entity.data.database import Database
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
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


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


@reflection.cache
def get_schema_names(self, connection, **kw):  # pylint: disable=unused-argument
    # Equivalent to SHOW DATABASES
    connection.execute(f"USE CATALOG {kw.get('database')}")
    return [row[0] for row in connection.execute("SHOW SCHEMAS")]


def get_schema_names_reflection(self, **kw):
    """Return all schema names."""

    if hasattr(self.dialect, "get_schema_names"):
        with self._operation_context() as conn:  # pylint: disable=protected-access
            return self.dialect.get_schema_names(conn, info_cache=self.info_cache, **kw)
    return []


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


DatabricksDialect.get_view_names = get_view_names
DatabricksDialect.get_columns = get_columns
DatabricksDialect.get_schema_names = get_schema_names
reflection.Inspector.get_schema_names = get_schema_names_reflection


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

    def set_inspector(self, database_name: str) -> None:
        """
        When sources override `get_database_names`, they will need
        to setup multiple inspectors. They can use this function.
        :param database_name: new database to set
        """
        logger.info(f"Ingesting from catalog: {database_name}")

        new_service_connection = deepcopy(self.service_connection)
        new_service_connection.catalog = database_name
        self.engine = get_connection(new_service_connection)
        self.inspector = inspect(self.engine)

    def get_database_names(self) -> Iterable[str]:
        configured_catalog = self.service_connection.__dict__.get("catalog")
        if configured_catalog:
            self.set_inspector(database_name=configured_catalog)
            yield configured_catalog
        else:
            results = self.connection.execute("SHOW CATALOGS")
            for res in results:
                if res:
                    new_catalog = res[0]
                    database_fqn = fqn.build(
                        self.metadata,
                        entity_type=Database,
                        service_name=self.context.database_service.name.__root__,
                        database_name=new_catalog,
                    )
                    if filter_by_database(
                        self.source_config.databaseFilterPattern,
                        database_fqn
                        if self.source_config.useFqnForFiltering
                        else new_catalog,
                    ):
                        self.status.filter(database_fqn, "Database Filtered Out")
                        continue
                    try:
                        self.set_inspector(database_name=new_catalog)
                        yield new_catalog
                    except Exception as exc:
                        logger.error(traceback.format_exc())
                        logger.warning(
                            f"Error trying to process database {new_catalog}: {exc}"
                        )

    def get_raw_database_schema_names(self) -> Iterable[str]:
        if self.service_connection.__dict__.get("databaseSchema"):
            yield self.service_connection.databaseSchema
        else:
            for schema_name in self.inspector.get_schema_names(
                database=self.context.database.name.__root__
            ):
                yield schema_name
