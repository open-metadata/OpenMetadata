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
Generic source to build SQL connectors.
"""

import traceback
from typing import Iterable, List, Optional, Tuple

from sqlalchemy.engine import Connection
from sqlalchemy.engine.base import Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.database_service import (
    DatabaseServiceSource,
    SQLSourceStatus,
)
from metadata.ingestion.source.database.sql_column_handler import SqlColumnHandler
from metadata.ingestion.source.database.sqlalchemy_source import SqlAlchemySource
from metadata.utils.connections import get_connection, test_connection
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class CommonDbSourceService(DatabaseServiceSource, SqlColumnHandler, SqlAlchemySource):
    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        # It will be one of the Unions. We don't know the specific type here.
        self.service_connection = self.config.serviceConnection.__root__.config
        self.status = SQLSourceStatus()

        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)

        self.engine: Engine = get_connection(self.service_connection)
        self.test_connection()

        self._connection = None  # Lazy init as well
        self.data_models = {}
        self.table_constraints = None
        self.database_source_state = set()
        super().__init__()

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        pass

    def set_inspector(self, database_name: str) -> None:
        """
        Default case, nothing to do.

        Sources with multiple databases will need to overwrite this.
        """
        self.inspector = inspect(self.engine)

    def get_database_names(self) -> List[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this.
        """

        database_name = self.service_connection.__dict__.get("database", "default")
        return [database_name]

    def yield_database(self) -> Iterable[CreateDatabaseRequest]:
        """
        From topology.
        Prepare a database request and pass it to the sink
        """
        for database_name in self.get_database_names():

            if filter_by_database(
                self.source_config.databaseFilterPattern, database_name=database_name
            ):
                self.status.filter(database_name, "Database pattern not allowed")
                continue

            self.set_inspector(database_name=database_name)
            yield CreateDatabaseRequest(
                name=database_name,
                service=EntityReference(
                    id=self.context.database_service.id,
                    type="databaseService",
                ),
            )

    def get_schema_names(self) -> List[str]:
        """
        return schema names
        """
        return self.inspector.get_schema_names()

    def yield_database_schema(self) -> Iterable[CreateDatabaseSchemaRequest]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """
        for schema in self.get_schema_names():

            if filter_by_schema(
                self.source_config.schemaFilterPattern, schema_name=schema
            ):
                self.status.filter(
                    f"{self.config.serviceName}.{self.service_connection.database}.{schema}",
                    "{} pattern not allowed".format("Schema"),
                )
                continue

            yield CreateDatabaseSchemaRequest(
                name=schema,
                database=EntityReference(id=self.context.database.id, type="database"),
            )

    @staticmethod
    def get_table_description(
        schema_name: str, table_name: str, inspector: Inspector
    ) -> str:
        description = None
        try:
            table_info: dict = inspector.get_table_comment(table_name, schema_name)
        # Catch any exception without breaking the ingestion
        except Exception as err:  # pylint: disable=broad-except
            logger.warning(f"Table Description Error : {str(err)}")
        else:
            description = table_info["text"]
        return description

    def get_table_names(
        self, schema_name: str, inspector: Inspector
    ) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Handle table and views
        :param schema_name: Schema to retrieve data from
        :param inspector: inspector used to get data
        :return: tables or views, depending on config
        """
        if self.source_config.includeTables:
            for table in inspector.get_table_names(schema_name):
                yield table, "Regular"
        if self.source_config.includeViews:
            for view in inspector.get_view_names(schema_name):
                yield view, "View"

    def get_view_definition(
        self, table_type: str, table_name: str, schema_name: str, inspector: Inspector
    ) -> Optional[str]:

        if table_type == "View":
            try:
                view_definition = inspector.get_view_definition(table_name, schema_name)
                view_definition = (
                    "" if view_definition is None else str(view_definition)
                )
                return view_definition
            except NotImplementedError:
                logger.error("View definition not implemented")
                return ""

    def is_partition(
            self, table_name: str, schema_name: str, inspector: Inspector
    ) -> bool:
        return False

    def yield_table(self) -> Iterable[CreateTableRequest]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        schema_name = self.context.database_schema.name.__root__
        db_name = self.context.database.name.__root__
        for table_name, table_type in self.get_table_names(schema_name, self.inspector):
            try:
                if filter_by_table(
                    self.source_config.tableFilterPattern, table_name=table_name
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{table_name}",
                        "Table pattern not allowed",
                    )
                    continue

                if self.is_partition(table_name=table_name, schema_name=schema_name, inspector=self.inspector):
                    self.status.filter(
                        f"{self.config.serviceName}.{table_name}",
                        "Table is partition",
                    )
                    continue

                columns, table_constraints = self.get_columns_and_constraints(
                    schema_name=schema_name,
                    table_name=table_name,
                    db_name=db_name,
                    inspector=self.inspector,
                )

                table_request = CreateTableRequest(
                    name=table_name,
                    tableType=table_type,
                    description=self.get_table_description(
                        schema_name=schema_name,
                        table_name=table_name,
                        inspector=self.inspector,
                    ),
                    columns=columns,
                    viewDefinition=self.get_view_definition(
                        table_type=table_type,
                        table_name=table_name,
                        schema_name=schema_name,
                        inspector=self.inspector,
                    ),
                    tableConstraints=table_constraints if table_constraints else None,
                    databaseSchema=EntityReference(
                        id=self.context.database_schema.id,
                        type="databaseSchema",
                    ),
                )

                yield table_request

                self.register_record(table_request=table_request)

            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(err)
                self.status.failures.append(
                    "{}.{}".format(self.config.serviceName, table_name)
                )

    def test_connection(self) -> None:
        """
        Used a timed-bound function to test that the engine
        can properly reach the source
        """
        test_connection(self.engine)

    @property
    def connection(self) -> Connection:
        """
        Return the SQLAlchemy connection
        """
        if not self._connection:
            self._connection = self.engine.connect()

        return self._connection

    def close(self):
        self._create_dbt_lineage()
        if self.connection is not None:
            self.connection.close()

    def get_status(self) -> SourceStatus:
        return self.status

    def fetch_table_tags(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> None:
        """
        Method to fetch tags associated with table
        """
        pass

    def standardize_schema_table_names(
        self, schema_name: str, table: str
    ) -> Tuple[str, str]:
        pass
