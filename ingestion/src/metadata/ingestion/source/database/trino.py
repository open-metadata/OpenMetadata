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

import logging
import re
import sys
from textwrap import dedent
from typing import Any, Dict, Iterable, List

import click
from sqlalchemy import inspect, sql, util
from sqlalchemy.engine import reflection
from sqlalchemy.engine.base import Connection
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.sql import sqltypes
from trino.sqlalchemy import datatype
from trino.sqlalchemy.dialect import TrinoDialect

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
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
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def parse_row_data_type(row: datatype.ROW) -> str:
    pass


def _get_columns(
    self, connection: Connection, table_name: str, schema: str = None, **kw
) -> List[Dict[str, Any]]:
    schema = schema or self._get_default_schema_name(connection)
    query = dedent(
        """
        SELECT
            "column_name",
            "data_type",
            "column_default",
            UPPER("is_nullable") AS "is_nullable"
        FROM "information_schema"."columns"
        WHERE "table_schema" = :schema
            AND "table_name" = :table
        ORDER BY "ordinal_position" ASC
    """
    ).strip()
    res = connection.execute(sql.text(query), schema=schema, table=table_name)
    columns = []

    for record in res:
        col_type = datatype.parse_sqltype(record.data_type)
        column = dict(
            name=record.column_name,
            type=col_type,
            nullable=record.is_nullable == "YES",
            default=record.column_default,
        )
        type_str = record.data_type.strip().lower()
        match = re.match(r"^(?P<type>\w+)\s*(?:\((?P<options>.*)\))?", record.data_type)
        if not match:
            util.warn(f"Could not parse type name '{type_str}'")
            return sqltypes.NULLTYPE
        type_name = match.group("type")
        type_opts = match.group("options")
        if type_opts:
            for i in datatype.aware_split(type_opts) or []:
                attr_name, attr_type_str = datatype.aware_split(
                    i.strip(), delimiter=" ", maxsplit=1
                )
        if type_name == "row":
            column["raw_data_type"] = record.data_type
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
            from trino import (
                dbapi,  # pylint: disable=import-outside-toplevel,unused-import
            )
        except ModuleNotFoundError:
            click.secho(
                "Trino source dependencies are missing. Please run\n"
                + "$ pip install --upgrade 'openmetadata-ingestion[trino]'",
                fg="red",
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

    def get_database_names(self) -> Iterable[str]:
        self.inspector = inspect(self.engine)
        yield self.trino_connection.catalog
