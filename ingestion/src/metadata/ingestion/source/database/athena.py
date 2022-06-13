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
from typing import Iterable, Optional, Tuple

from pyathena.sqlalchemy_athena import AthenaDialect
from sqlalchemy import types

from metadata.generated.schema.entity.data.table import TableType
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
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def _get_column_type(self, type_):
    """
    Function overwritten from AthenaDialect
    to add custom SQA typing.
    """
    match = self._pattern_column_type.match(type_)
    if match:
        name = match.group(1).lower()
        length = match.group(2)
    else:
        name = type_.lower()
        length = None

    args = []
    if name in ["boolean"]:
        col_type = types.BOOLEAN
    elif name in ["float", "double", "real"]:
        col_type = types.FLOAT
    elif name in ["tinyint", "smallint", "integer", "int"]:
        col_type = types.INTEGER
    elif name in ["bigint"]:
        col_type = types.BIGINT
    elif name in ["decimal"]:
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
    elif name in ["string"]:
        col_type = types.String
    elif name in ["date"]:
        col_type = types.DATE
    elif name in ["timestamp"]:
        col_type = types.TIMESTAMP
    elif name in ["binary", "varbinary"]:
        col_type = types.BINARY
    elif name in ["array"]:
        col_type = types.ARRAY
    elif name in ["json"]:
        col_type = types.JSON
    elif name in ["struct", "row"]:
        col_type = sqa_types.SQAStruct
    elif name in ["map"]:
        col_type = sqa_types.SQAMap
    else:
        logger.warn(f"Did not recognize type '{type_}'")
        col_type = types.NullType
    return col_type(*args)


AthenaDialect._get_column_type = _get_column_type


class AthenaSource(CommonDbSourceService):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)

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
                if filter_by_table(
                    self.source_config.tableFilterPattern, table_name=table_name
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{table_name}",
                        "Table pattern not allowed",
                    )
                    continue

                yield table_name, TableType.External  # All tables in Athena are external

        if self.source_config.includeViews:
            for view_name in self.inspector.get_view_names(schema_name):
                if filter_by_table(
                    self.source_config.tableFilterPattern, table_name=view_name
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{view_name}",
                        "Table pattern not allowed for view",
                    )
                    continue

                yield view_name, TableType.View
