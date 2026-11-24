#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
MongoDB source methods.
"""

import traceback
from collections.abc import Iterable

from pymongo.errors import OperationFailure

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_nosql_source import (
    SAMPLE_SIZE,
    CommonNoSQLSource,
    TableNameAndType,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MongodbSource(CommonNoSQLSource):
    """
    Implements the necessary methods to extract
    Database metadata from Dynamo Source
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.mongodb = self.connection_obj

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: MongoDBConnection = config.serviceConnection.root.config
        if not isinstance(connection, MongoDBConnection):
            raise InvalidSourceException(f"Expected MongoDBConnection, but got {connection}")
        return cls(config, metadata)

    def get_schema_name_list(self) -> list[str]:
        """
        Method to get list of schema names available within NoSQL db
        need to be overridden by sources
        """
        try:
            if self.service_connection.databaseSchema:
                return [self.service_connection.databaseSchema]
            return self.mongodb.list_database_names()
        except Exception as exp:
            logger.debug(f"Failed to list database names: {exp}")
            logger.debug(traceback.format_exc())
        return []

    def query_table_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        return self._list_collections(schema_name, {"type": {"$ne": "view"}}, TableType.Regular)

    def query_view_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        return self._list_collections(schema_name, {"type": "view"}, TableType.View)

    def _list_collections(
        self, schema_name: str, collection_filter: dict, table_type: TableType
    ) -> list[TableNameAndType]:
        try:
            database = self.mongodb.get_database(schema_name)
            return [
                TableNameAndType(name=name, type_=table_type)
                for name in database.list_collection_names(filter=collection_filter)
            ]
        except Exception as exp:
            logger.debug("Failed to list %s names for schema [%s]: %s", table_type.value, schema_name, exp)
            logger.debug(traceback.format_exc())
        return []

    def get_table_columns_dict(self, schema_name: str, table_name: str) -> list[dict] | dict:
        """
        Method to get actual data available within table
        need to be overridden by sources
        """
        try:
            database = self.mongodb[schema_name]
            collection = database.get_collection(table_name)
            return list(collection.find().limit(SAMPLE_SIZE))
        except OperationFailure as opf:
            logger.debug(f"Failed to read collection [{table_name}]: {opf}")
            logger.debug(traceback.format_exc())
        return []
