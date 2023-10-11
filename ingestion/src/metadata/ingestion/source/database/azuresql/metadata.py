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
"""Azure SQL source module"""

import traceback
from typing import Iterable, Optional, Tuple

from sqlalchemy.dialects.mssql.base import MSDialect, ischema_names
from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    AzureSQLConnection,
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
from metadata.ingestion.source.database.mssql.queries import MSSQL_GET_TABLES_NAMES
from metadata.ingestion.source.database.mssql.utils import (
    get_columns,
    get_filter_pattern_query,
    get_schema_names,
    get_schema_names_reflection,
    get_table_comment,
    get_view_definition,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_view_definitions,
)

logger = ingestion_logger()

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


class AzuresqlSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Azuresql Source
    """

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: AzureSQLConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, AzureSQLConnection):
            raise InvalidSourceException(
                f"Expected AzureSQLConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:

        if not self.config.serviceConnection.__root__.config.ingestAllDatabases:
            configured_db = self.config.serviceConnection.__root__.config.database
            self.set_inspector(database_name=configured_db)
            yield configured_db
        else:
            query = "SELECT name FROM master.sys.databases {} order by name"
            if self.source_config.databaseFilterPattern:
                format_pattern = (
                    f"where {get_filter_pattern_query(self.source_config.databaseFilterPattern.includes,'name')}"
                    if self.source_config.databaseFilterPattern.includes
                    else f"where {get_filter_pattern_query(self.source_config.databaseFilterPattern.excludes,'name', exclude=True)}"  # pylint: disable=line-too-long
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

    def _get_filtered_schema_names(
        self, return_fqn: bool = False, add_to_status: bool = True
    ) -> Iterable[str]:
        for schema_name in self.get_raw_database_schema_names():
            schema_fqn = fqn.build(
                self.metadata,
                entity_type=DatabaseSchema,
                service_name=self.context.database_service.name.__root__,
                database_name=self.context.database.name.__root__,
                schema_name=schema_name,
            )
            if not self.source_config.pushFilterDown:
                if filter_by_schema(
                    self.source_config.schemaFilterPattern,
                    schema_fqn
                    if self.source_config.useFqnForFiltering
                    else schema_name,
                ):
                    if add_to_status:
                        self.status.filter(schema_fqn, "Schema Filtered Out")
                    continue
            yield schema_fqn if return_fqn else schema_name

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Overwrite the inspector implementation to handle partitioned
        and foreign types
        """

        query = MSSQL_GET_TABLES_NAMES
        if self.source_config.tableFilterPattern:
            format_pattern = (
                f"and ({get_filter_pattern_query(self.source_config.tableFilterPattern.includes,'table_name')})"
                if self.source_config.tableFilterPattern.includes
                else f"and ({get_filter_pattern_query(self.source_config.tableFilterPattern.excludes, 'table_name',exclude=True)})"  # pylint: disable=line-too-long
            )

        result = self.connection.execute(
            query.format(format_pattern)
            if self.source_config.pushFilterDown
            and self.source_config.tableFilterPattern
            else query.format("")
        )

        return [
            TableNameAndType(name=name[0], type_=TableType.Regular) for name in result
        ]

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Handle table and views.

        Fetches them up using the context information and
        the inspector set when preparing the db.

        :return: tables or views, depending on config
        """
        try:
            schema_name = self.context.database_schema.name.__root__
            if self.source_config.includeTables:
                for table_and_type in self.query_table_names_and_types(schema_name):
                    table_name = self.standardize_table_name(
                        schema_name, table_and_type.name
                    )
                    table_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.context.database_service.name.__root__,
                        database_name=self.context.database.name.__root__,
                        schema_name=self.context.database_schema.name.__root__,
                        table_name=table_name,
                        skip_es_search=True,
                    )
                    if not self.source_config.pushFilterDown:
                        if filter_by_table(
                            self.source_config.tableFilterPattern,
                            table_fqn
                            if self.source_config.useFqnForFiltering
                            else table_name,
                        ):
                            self.status.filter(
                                table_fqn,
                                "Table Filtered Out",
                            )
                            continue
                    yield table_name, table_and_type.type_

            if self.source_config.includeViews:
                for view_name in self.inspector.get_view_names(schema_name):
                    view_name = self.standardize_table_name(schema_name, view_name)
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
                        view_fqn
                        if self.source_config.useFqnForFiltering
                        else view_name,
                    ):
                        self.status.filter(
                            view_fqn,
                            "Table Filtered Out",
                        )
                        continue
                    yield view_name, TableType.View
        except Exception as err:
            logger.warning(
                f"Fetching tables names failed for schema {schema_name} due to - {err}"
            )
            logger.debug(traceback.format_exc())
