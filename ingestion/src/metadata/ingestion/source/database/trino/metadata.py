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
Trino source implementation.
"""
import re
import traceback
from copy import deepcopy
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy import exc, sql, util
from sqlalchemy.engine.base import Connection
from sqlalchemy.sql import sqltypes
from trino.sqlalchemy import datatype, error
from trino.sqlalchemy.datatype import JSON
from trino.sqlalchemy.dialect import TrinoDialect

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.trino.queries import TRINO_TABLE_COMMENTS
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import get_all_table_comments

logger = ingestion_logger()
ROW_DATA_TYPE = "row"
ARRAY_DATA_TYPE = "array"


def get_type_name_and_opts(type_str: str) -> Tuple[str, Optional[str]]:
    match = re.match(r"^(?P<type>\w+)\s*(?:\((?P<options>.*)\))?", type_str)
    if not match:
        util.warn(f"Could not parse type name '{type_str}'")
        return sqltypes.NULLTYPE
    type_name = match.group("type")
    type_opts = match.group("options")
    return type_name, type_opts


def parse_array_data_type(type_str: str) -> str:
    """
    This mehtod is used to convert the complex array datatype to the format that is supported by OpenMetadata
    For Example:
    If we have a row type as array(row(col1 bigint, col2 string))
    this method will return type as -> array<struct<col1:bigint,col2:string>>
    """
    type_name, type_opts = get_type_name_and_opts(type_str)
    final = type_name + "<"
    if type_opts:
        if type_opts.startswith(ROW_DATA_TYPE):
            final += parse_row_data_type(type_opts)
        elif type_opts.startswith(ARRAY_DATA_TYPE):
            final += parse_array_data_type(type_opts)
        else:
            final += type_opts
    return final + ">"


def parse_row_data_type(type_str: str) -> str:
    """
    This mehtod is used to convert the complex row datatype to the format that is supported by OpenMetadata
    For Example:
    If we have a row type as row(col1 bigint, col2 bigint, col3 row(col4 string, col5 bigint))
    this method will return type as -> struct<col1:bigint,col2:bigint,col3:struct<col4:string,col5:bigint>>
    """
    type_name, type_opts = get_type_name_and_opts(type_str)
    final = type_name.replace(ROW_DATA_TYPE, "struct") + "<"
    if type_opts:
        for data_type in datatype.aware_split(type_opts) or []:
            attr_name, attr_type_str = datatype.aware_split(
                data_type.strip(), delimiter=" ", maxsplit=1
            )
            if attr_type_str.startswith(ROW_DATA_TYPE):
                final += attr_name + ":" + parse_row_data_type(attr_type_str) + ","
            elif attr_type_str.startswith(ARRAY_DATA_TYPE):
                final += attr_name + ":" + parse_array_data_type(attr_type_str) + ","
            else:
                final += attr_name + ":" + attr_type_str + ","
    return final[:-1] + ">"


def _get_columns(
    self, connection: Connection, table_name: str, schema: str = None, **__
) -> List[Dict[str, Any]]:
    # pylint: disable=protected-access
    schema = schema or self._get_default_schema_name(connection)
    query = f'SHOW COLUMNS FROM {schema}."{table_name}"'

    res = connection.execute(sql.text(query), schema=schema, table=table_name)
    columns = []
    for record in res:
        col_type = datatype.parse_sqltype(record.Type)
        column = {
            "name": record.Column,
            "type": col_type,
            "nullable": True,
            "comment": record.Comment,
            "system_data_type": record.Type,
        }
        type_str = record.Type.strip().lower()
        type_name, type_opts = get_type_name_and_opts(type_str)
        if type_opts and type_name == ROW_DATA_TYPE:
            column["system_data_type"] = parse_row_data_type(type_str)
            column["is_complex"] = True
        elif type_opts and type_name == ARRAY_DATA_TYPE:
            column["system_data_type"] = parse_array_data_type(type_str)
            column["is_complex"] = True
        columns.append(column)
    return columns


def get_table_comment(  # pylint: disable=unused-argument
    self, connection: Connection, table_name: str, schema: str = None, **kw
) -> Dict[str, Any]:
    """
    Override get table comment method to batch process comments
    """
    catalog_name = self._get_default_catalog_name(  # pylint: disable=protected-access
        connection
    )
    if catalog_name is None:
        raise exc.NoSuchTableError("catalog is required in connection")
    schema_name = (
        self._get_default_schema_name(connection)  # pylint: disable=protected-access
        or schema
    )
    if schema_name is None:
        raise exc.NoSuchTableError("schema is required")
    self.processed_schema = (
        self.processed_schema if hasattr(self, "processed_schema") else set()
    )
    try:
        if (
            not hasattr(self, "all_table_comments")
            or self.current_db != connection.engine.url.database
            or schema not in self.processed_schema
        ):
            self.processed_schema.add(schema)
            self.get_all_table_comments(
                connection,
                TRINO_TABLE_COMMENTS.format(
                    catalog_name=catalog_name, schema_name=schema
                ),
            )
        return {"text": self.all_table_comments.get((table_name, schema))}
    except error.TrinoQueryError as exe:
        if exe.error_name in (error.PERMISSION_DENIED,):
            return {"text": None}
        raise


TrinoDialect._get_columns = _get_columns  # pylint: disable=protected-access
TrinoDialect.get_all_table_comments = get_all_table_comments
TrinoDialect.get_table_comment = get_table_comment


class TrinoSource(CommonDbSourceService):
    """
    Trino does not support querying by table type: Getting views is not supported.
    """

    ColumnTypeParser._COLUMN_TYPE_MAPPING[  # pylint: disable=protected-access
        JSON
    ] = "JSON"

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: TrinoConnection = config.serviceConnection.root.config
        if not isinstance(connection, TrinoConnection):
            raise InvalidSourceException(
                f"Expected TrinoConnection, but got {connection}"
            )
        return cls(config, metadata)

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
        self._connection_map = {}  # Lazy init as well
        self._inspector_map = {}

    def get_database_names(self) -> Iterable[str]:
        configured_catalog = self.service_connection.catalog
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
                        service_name=self.context.get().database_service,
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
                    except Exception as err:
                        logger.debug(traceback.format_exc())
                        logger.warning(
                            f"Error trying to connect to database {new_catalog}: {err}"
                        )
