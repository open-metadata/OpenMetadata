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

from pandas import json_normalize
from pymongo.errors import OperationFailure

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
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.datalake.metadata import DatalakeSource
from metadata.utils import fqn
from metadata.utils.constants import DEFAULT_DATABASE
from metadata.utils.datalake.datalake_utils import (
    COMPLEX_COLUMN_SEPARATOR,
    dataframe_to_chunks,
)
from metadata.utils.filters import filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


SAMPLE_SIZE = 1000


class MongodbSource(DatabaseServiceSource):
    """
    Implements the necessary methods to extract
    Database metadata from Dynamo Source
    """

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service_connection: MongoDBConnection = (
            self.config.serviceConnection.__root__.config
        )
        self.mongodb = get_connection(self.service_connection)
        self.connection_obj = self.mongodb
        self.test_connection()

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
        """
        by default there is nothing to prepare
        """

    def get_database_names(self) -> Iterable[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this and
        apply the necessary filters.
        """
        yield self.service_connection.databaseName or DEFAULT_DATABASE

    def yield_database(self, database_name: str) -> Iterable[CreateDatabaseRequest]:
        """
        From topology.
        Prepare a database request and pass it to the sink
        """

        yield CreateDatabaseRequest(
            name=database_name,
            service=self.context.database_service.fullyQualifiedName.__root__,
        )

    def get_database_schema_names(self) -> Iterable[str]:
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

            yield schema

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[CreateDatabaseSchemaRequest]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """

        yield CreateDatabaseSchemaRequest(
            name=schema_name,
            database=self.context.database.fullyQualifiedName.__root__,
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
                table_name = collection
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
            data = collection.find().limit(SAMPLE_SIZE)
            df = json_normalize(list(data), sep=COMPLEX_COLUMN_SEPARATOR)
            columns = DatalakeSource.get_columns(df)
            table_request = CreateTableRequest(
                name=table_name,
                tableType=table_type,
                description="",
                columns=columns,
                tableConstraints=None,
                databaseSchema=self.context.database_schema.fullyQualifiedName.__root__,
            )

            yield table_request
            self.register_record(table_request=table_request)
        except OperationFailure as opf:
            logger.debug(f"Failed to read collection [{table_name}]: {opf}")
            logger.debug(traceback.format_exc())
        except Exception as exc:
            error = f"Unexpected exception to yield table [{table_name}]: {exc}"
            logger.debug(traceback.format_exc())
            logger.warning(error)
            self.status.failed(table_name, error, traceback.format_exc())

    def yield_view_lineage(self) -> Optional[Iterable[AddLineageRequest]]:
        """
        views are not supported with mongo
        """

    def yield_tag(self, schema_name: str) -> Iterable[OMetaTagAndClassification]:
        """
        tags are not supported with mongo
        """

    def close(self):
        self.mongodb.close()
