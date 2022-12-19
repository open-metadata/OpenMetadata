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
Dynamo source methods.
"""

import traceback
from typing import Iterable, Optional, Tuple

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, Table, TableType
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection,
)
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
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.database_service import (
    DatabaseServiceSource,
    SQLSourceStatus,
)
from metadata.utils import fqn
from metadata.utils.connections import get_connection
from metadata.utils.filters import filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MongodbSource(DatabaseServiceSource):
    """
    Implements the necessary methods to extract
    Database metadata from Dynamo Source
    """

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        self.status = SQLSourceStatus()
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service_connection = self.config.serviceConnection.__root__.config
        self.connection = get_connection(self.service_connection)
        self.mongodb = self.connection.client
        self.data_models = {}
        self.dbt_tests = {}
        self.database_source_state = set()
        super().__init__()

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: MongoDBConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, MongoDBConnection):
            raise InvalidSourceException(
                f"Expected MongoDBConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        pass

    def get_database_names(self) -> Iterable[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this and
        apply the necessary filters.
        """

        database_name = "default"
        yield database_name

    def yield_database(self, database_name: str) -> Iterable[CreateDatabaseRequest]:
        """
        From topology.
        Prepare a database request and pass it to the sink
        """

        yield CreateDatabaseRequest(
            name=database_name,
            service=EntityReference(
                id=self.context.database_service.id,
                type="databaseService",
            ),
        )

    def get_database_schema_names(self) -> Iterable[str]:
        configured_db_schema = (
            self.config.serviceConnection.__root__.config.databaseSchema
        )
        if configured_db_schema:
            yield configured_db_schema
        else:
            database_list = self.mongodb.list_database_names()
            for schema in database_list:
                schema_fqn = fqn.build(
                    self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.database_service.name.__root__,
                    database_name=self.context.database.name.__root__,
                    schema_name=schema,
                )

                if filter_by_schema(
                    self.source_config.schemaFilterPattern,
                    schema_fqn if self.source_config.useFqnForFiltering else schema,
                ):
                    self.status.filter(schema_fqn, "Schema Filtered Out")
                    continue

                try:
                    yield schema
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(f"Error trying to connect to database {schema}: {exc}")

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[CreateDatabaseSchemaRequest]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """

        yield CreateDatabaseSchemaRequest(
            name=schema_name,
            database=EntityReference(id=self.context.database.id, type="database"),
        )

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Handle table and views.

        Fetches them up using the context information and
        the inspector set when preparing the db.

        :return: tables or views, depending on config
        """
        schema_name = self.context.database_schema.name.__root__
        if self.source_config.includeTables:
            database = self.mongodb.get_database(schema_name)
            collections = database.list_collection_names()
            for collection in collections:
                table_name = self.standardize_table_name(schema_name, collection)
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
                yield table_name, TableType.Regular

    def get_columns(self, column_data):
        for column in column_data:
            try:
                parsed_string = ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
                    type(column_data[column]).__name__
                )
                if isinstance(parsed_string, list):

                    parsed_string["dataTypeDisplay"] = "UNION"
                    parsed_string["dataType"] = "UNION"

                parsed_string["name"] = column[:64]
                yield Column(**parsed_string)
            except Exception as exc:
                logger.error(traceback.format_exc())
                logger.warning(f"Unexpected exception parsing column [{column}]: {exc}")

    def yield_table(
        self, table_name_and_type: Tuple[str, str]
    ) -> Iterable[Optional[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        try:
            database = self.mongodb[self.context.database_schema.name.__root__]
            collection = database.get_collection(table_name)
            if collection.find_one():
                columns = self.get_columns(collection.find_one())

                table_request = CreateTableRequest(
                    name=table_name,
                    tableType=table_type,
                    description="",
                    columns=columns,
                    tableConstraints=None,
                    databaseSchema=EntityReference(
                        id=self.context.database_schema.id,
                        type="databaseSchema",
                    ),
                )

                yield table_request
                self.register_record(table_request=table_request)

        except Exception as exc:
            logger.error(traceback.format_exc())
            logger.warning(f"Unexpected exception to yield table [{table_name}]: {exc}")
            self.status.failures.append(f"{self.config.serviceName}.{table_name}")

    def yield_view_lineage(self) -> Optional[Iterable[AddLineageRequest]]:
        yield from []

    def yield_tag(self, schema_name: str) -> Iterable[OMetaTagAndCategory]:
        pass

    def standardize_table_name(self, _: str, table: str) -> str:
        return table

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def test_connection(self) -> None:
        pass
