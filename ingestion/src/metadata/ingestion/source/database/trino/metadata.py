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
import logging
import re
import sys
import traceback
from copy import deepcopy
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy import inspect, sql, util
from sqlalchemy.engine.base import Connection
from sqlalchemy.sql import sqltypes
from trino.sqlalchemy import datatype
from trino.sqlalchemy.dialect import TrinoDialect

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
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
from metadata.utils.logger import ANSI, ingestion_logger, log_ansi_encoded_string

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
    query = f"SHOW COLUMNS FROM {schema}.{table_name}"

    res = connection.execute(sql.text(query), schema=schema, table=table_name)
    columns = []
    for record in res:
        col_type = datatype.parse_sqltype(record.Type)
        column = {
            "name": record.Column,
            "type": col_type,
            "nullable": True,
            "comment": record.Comment,
        }
        type_str = record.Type.strip().lower()
        type_name, type_opts = get_type_name_and_opts(type_str)
        if type_opts and type_name == ROW_DATA_TYPE:
            column["raw_data_type"] = parse_row_data_type(type_str)
        elif type_opts and type_name == ARRAY_DATA_TYPE:
            column["raw_data_type"] = parse_array_data_type(type_str)
        columns.append(column)
    return columns


TrinoDialect._get_columns = _get_columns  # pylint: disable=protected-access


class TrinoSource(CommonDbSourceService):
    """
    Trino does not support querying by table type: Getting views is not supported.
    """

    def __init__(self, config, metadata_config):
        self.trino_connection: TrinoConnection = (
            config.serviceConnection.__root__.config
        )
        try:
            from trino import (  # pylint: disable=import-outside-toplevel,unused-import
                dbapi,
            )
        except ModuleNotFoundError:
            log_ansi_encoded_string(
                color=ANSI.BRIGHT_RED,
                bold=False,
                message="Trino source dependencies are missing. Please run\n"
                "$ pip install --upgrade 'openmetadata-ingestion[trino]'",
            )
            if logger.isEnabledFor(logging.DEBUG):
                raise
            sys.exit(1)
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: TrinoConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, TrinoConnection):
            raise InvalidSourceException(
                f"Expected TrinoConnection, but got {connection}"
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
        configured_catalog = self.trino_connection.catalog
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
                        logger.debug(traceback.format_exc())
                        logger.warning(
                            f"Error trying to connect to database {new_catalog}: {exc}"
                        )
