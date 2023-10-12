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
"""Mysql source module"""

from typing import Iterable, cast

from sqlalchemy.dialects.mysql.base import MySQLDialect, ischema_names
from sqlalchemy.dialects.mysql.reflection import MySQLTableDefinitionParser
from sqlalchemy.engine import Inspector

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.mysql.queries import MYSQL_GET_TABLE
from metadata.ingestion.source.database.mysql.utils import (
    col_type_map,
    get_filter_pattern_query,
    get_schema_names,
    get_schema_names_reflection,
    parse_column,
)
from metadata.utils.logger import ingestion_logger

ischema_names.update(col_type_map)


MySQLTableDefinitionParser._parse_column = (  # pylint: disable=protected-access
    parse_column
)
MySQLDialect.get_schema_names = get_schema_names
Inspector.get_schema_names = get_schema_names_reflection


logger = ingestion_logger()


class MysqlSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Mysql Source
    """

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        if config.serviceConnection is None:
            raise InvalidSourceException("Missing service connection")
        connection = cast(MysqlConnection, config.serviceConnection.__root__.config)
        if not isinstance(connection, MysqlConnection):
            raise InvalidSourceException(
                f"Expected MysqlConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_raw_database_schema_names(self) -> Iterable[str]:
        if self.service_connection.__dict__.get("databaseSchema"):
            yield self.service_connection.databaseSchema
        else:
            for schema_name in self.inspector.get_schema_names(
                pushFilterDown=self.source_config.pushFilterDown,
                filter_pattern=self.source_config.schemaFilterPattern,
            ):
                yield schema_name

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Overwrite the inspector implementation to handle partitioned
        and foreign types
        """
        if self.source_config.tableFilterPattern:
            tb_patterns_include = [
                tb_name.replace("%", "%%")
                for tb_name in self.source_config.tableFilterPattern.includes
                if self.source_config.tableFilterPattern.includes
            ]
            tb_patterns_exclude = [
                tb_name.replace("%", "%%")
                for tb_name in self.source_config.tableFilterPattern.excludes
                if self.source_config.tableFilterPattern.excludes
            ]

            format_pattern = (
                f"and ({get_filter_pattern_query(tb_patterns_include,'table_name')})"
                if self.source_config.tableFilterPattern.includes
                else f"and ({get_filter_pattern_query(tb_patterns_exclude, 'table_name',exclude=True)})"
            )
        query = MYSQL_GET_TABLE
        result = self.connection.execute(
            query.format(format_pattern)
            if self.source_config.pushFilterDown
            and self.source_config.tableFilterPattern
            else query.format("")
        )

        return [
            TableNameAndType(name=name[0], type_=TableType.Regular) for name in result
        ]
