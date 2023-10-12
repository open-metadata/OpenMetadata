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
"""MSSQL source module"""
import traceback
from typing import Iterable

from sqlalchemy.dialects.mssql.base import MSDialect, ischema_names
from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.mssql.queries import (
    MSSQL_GET_DATABASE,
    MSSQL_GET_TABLES_NAMES,
)
from metadata.ingestion.source.database.mssql.utils import (
    get_columns,
    get_filter_pattern_query,
    get_schema_names,
    get_schema_names_reflection,
    get_table_comment,
    get_view_definition,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_view_definitions,
)

logger = ingestion_logger()

# The ntext, text, and image data types will be removed in a future version of SQL Server.
# Avoid using these data types in new development work, and plan to modify applications that currently use them.
# Use nvarchar(max), varchar(max), and varbinary(max) instead.
# ref: https://learn.microsoft.com/en-us/sql/t-sql/data-types/ntext-text-and-image-transact-sql?view=sql-server-ver16
ischema_names.update(
    {
        "nvarchar": create_sqlalchemy_type("NVARCHAR"),
        "nchar": create_sqlalchemy_type("NCHAR"),
        "ntext": create_sqlalchemy_type("NTEXT"),
        "bit": create_sqlalchemy_type("BIT"),
        "image": create_sqlalchemy_type("IMAGE"),
        "binary": create_sqlalchemy_type("BINARY"),
        "smallmoney": create_sqlalchemy_type("SMALLMONEY"),
        "money": create_sqlalchemy_type("MONEY"),
        "real": create_sqlalchemy_type("REAL"),
        "smalldatetime": create_sqlalchemy_type("SMALLDATETIME"),
        "datetime2": create_sqlalchemy_type("DATETIME2"),
        "datetimeoffset": create_sqlalchemy_type("DATETIMEOFFSET"),
        "sql_variant": create_sqlalchemy_type("SQL_VARIANT"),
        "uniqueidentifier": create_sqlalchemy_type("UUID"),
        "xml": create_sqlalchemy_type("XML"),
    }
)

MSDialect.get_table_comment = get_table_comment
MSDialect.get_view_definition = get_view_definition
MSDialect.get_all_view_definitions = get_all_view_definitions
MSDialect.get_all_table_comments = get_all_table_comments
MSDialect.get_columns = get_columns
MSDialect.get_schema_names = get_schema_names
Inspector.get_schema_names = get_schema_names_reflection


class MssqlSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from MSSQL Source
    """

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: MssqlConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, MssqlConnection):
            raise InvalidSourceException(
                f"Expected MssqlConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:

        if not self.config.serviceConnection.__root__.config.ingestAllDatabases:
            configured_db = self.config.serviceConnection.__root__.config.database
            self.set_inspector(database_name=configured_db)
            yield configured_db
        else:
            query = MSSQL_GET_DATABASE
            if self.source_config.databaseFilterPattern:
                include_pattern = get_filter_pattern_query(
                    self.source_config.databaseFilterPattern.includes, "name"
                )
                exclude_pattern = get_filter_pattern_query(
                    self.source_config.databaseFilterPattern.excludes,
                    "name",
                    exclude=True,
                )
                format_pattern = (
                    f"where {include_pattern}"
                    if self.source_config.databaseFilterPattern.includes
                    else f"where {exclude_pattern}"
                )
            results = self.connection.execute(
                query.format(format_pattern)
                if self.source_config.pushFilterDown
                and self.source_config.databaseFilterPattern
                else query.format("")
            )
            for res in results:
                row = list(res)
                new_database = row[0]
                database_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.database_service.name.__root__,
                    database_name=new_database,
                )
                if not self.source_config.pushFilterDown:
                    if filter_by_database(
                        self.source_config.databaseFilterPattern,
                        database_fqn
                        if self.source_config.useFqnForFiltering
                        else new_database,
                    ):
                        self.status.filter(database_fqn, "Database Filtered Out")
                        continue

                try:
                    self.set_inspector(database_name=new_database)
                    yield new_database
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error trying to connect to database {new_database}: {exc}"
                    )

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

        query = MSSQL_GET_TABLES_NAMES
        if self.source_config.tableFilterPattern:
            include_pattern = get_filter_pattern_query(
                self.source_config.tableFilterPattern.includes, "table_name"
            )
            exclude_pattern = get_filter_pattern_query(
                self.source_config.tableFilterPattern.excludes,
                "table_name",
                exclude=True,
            )
            format_pattern = (
                f"and ({include_pattern})"
                if self.source_config.tableFilterPattern.includes
                else f"and ({exclude_pattern})"
            )

        result = self.connection.execute(
            query.format(format_pattern)
            if self.source_config.pushFilterDown
            and self.source_config.databaseFilterPattern
            else query.format("")
        )

        return [
            TableNameAndType(name=name[0], type_=TableType.Regular) for name in result
        ]
