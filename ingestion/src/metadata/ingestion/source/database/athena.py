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

"""Athena source module"""

from typing import Iterable, Optional, Tuple

from pyathena.sqlalchemy_athena import AthenaDialect
from sqlalchemy import types
from sqlalchemy.engine import reflection

from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source import sqa_types
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils import fqn
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def _get_column_type(self, type_):
    """
    Function overwritten from AthenaDialect
    to add custom SQA typing.
    """
    type_ = type_.replace(" ", "").lower()
    match = self._pattern_column_type.match(type_)  # pylint: disable=protected-access
    if match:
        name = match.group(1).lower()
        length = match.group(2)
    else:
        name = type_.lower()
        length = None

    args = []
    col_map = {
        "boolean": types.BOOLEAN,
        "float": types.FLOAT,
        "double": types.FLOAT,
        "real": types.FLOAT,
        "tinyint": types.INTEGER,
        "smallint": types.INTEGER,
        "integer": types.INTEGER,
        "int": types.INTEGER,
        "bigint": types.BIGINT,
        "string": types.String,
        "date": types.DATE,
        "timestamp": types.TIMESTAMP,
        "binary": types.BINARY,
        "varbinary": types.BINARY,
        "array": types.ARRAY,
        "json": types.JSON,
        "struct": sqa_types.SQAStruct,
        "row": sqa_types.SQAStruct,
        "map": sqa_types.SQAMap,
    }
    if name in ["decimal"]:
        col_type = types.DECIMAL
        if length:
            precision, scale = length.split(",")
            args = [int(precision), int(scale)]
    elif name in ["char"]:
        col_type = types.CHAR
        if length:
            args = [int(length)]
    elif name in ["varchar"]:
        col_type = types.VARCHAR
        if length:
            args = [int(length)]
    elif type_.startswith("array"):
        parsed_type = (
            ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
                type_
            )
        )
        col_type = col_map["array"]
        args = [col_map.get(parsed_type.get("arrayDataType").lower(), types.String)]
    elif col_map.get(name):
        col_type = col_map.get(name)
    else:
        logger.warning(f"Did not recognize type '{type_}'")
        col_type = types.NullType
    return col_type(*args)


def is_complex(type_: str):
    return (
        type_.startswith("array")
        or type_.startswith("map")
        or type_.startswith("struct")
        or type_.startswith("row")
    )


@reflection.cache
def get_columns(self, connection, table_name, schema=None, **kw):
    """
    Method to handle table columns
    """
    metadata = self._get_table(  # pylint: disable=protected-access
        connection, table_name, schema=schema, **kw
    )
    columns = [
        {
            "name": c.name,
            "type": self._get_column_type(c.type),  # pylint: disable=protected-access
            "nullable": True,
            "default": None,
            "autoincrement": False,
            "comment": c.comment,
            "raw_data_type": c.type if is_complex(c.type) else None,
            "dialect_options": {"awsathena_partition": None},
        }
        for c in metadata.columns
    ]
    columns += [
        {
            "name": c.name,
            "type": self._get_column_type(c.type),  # pylint: disable=protected-access
            "nullable": True,
            "default": None,
            "autoincrement": False,
            "comment": c.comment,
            "raw_data_type": c.type if is_complex(c.type) else None,
            "dialect_options": {"awsathena_partition": True},
        }
        for c in metadata.partition_keys
    ]
    return columns


AthenaDialect._get_column_type = _get_column_type  # pylint: disable=protected-access
AthenaDialect.get_columns = get_columns


class AthenaSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Athena Source
    """

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: AthenaConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, AthenaConnection):
            raise InvalidSourceException(
                f"Expected AthenaConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Handle table and views.

        Fetches them up using the context information and
        the inspector set when preparing the db.

        :return: tables or views, depending on config
        """
        schema_name = self.context.database_schema.name.__root__
        if self.source_config.includeTables:
            for table_name in self.inspector.get_table_names(schema_name):
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.context.database_service.name.__root__,
                    database_name=self.context.database.name.__root__,
                    schema_name=self.context.database_schema.name.__root__,
                    table_name=table_name,
                )
                if filter_by_table(
                    self.source_config.tableFilterPattern,
                    table_fqn if self.source_config.useFqnForFiltering else table_name,
                ):
                    self.status.filter(
                        table_fqn,
                        "Table Filtered Out",
                    )
                    continue

                yield table_name, TableType.External  # All tables in Athena are external

        if self.source_config.includeViews:
            for view_name in self.inspector.get_view_names(schema_name):
                view_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.context.database_service.name.__root__,
                    database_name=self.context.database.name.__root__,
                    schema_name=self.context.database_schema.name.__root__,
                    table_name=view_name,
                )
                if filter_by_table(
                    self.source_config.tableFilterPattern,
                    view_fqn if self.source_config.useFqnForFiltering else view_name,
                ):
                    self.status.filter(
                        view_fqn,
                        "Table Filtered Out",
                    )
                    continue

                yield view_name, TableType.View
