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
Cassandra source methods.
"""

import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.entity.data.table import Column, TableType
from metadata.generated.schema.entity.services.connections.database.cassandraConnection import (
    CassandraConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.cassandra.helpers import CassandraColumnParser
from metadata.ingestion.source.database.cassandra.queries import (
    CASSANDRA_GET_KEYSPACE_MATERIALIZED_VIEWS,
    CASSANDRA_GET_KEYSPACE_TABLES,
    CASSANDRA_GET_KEYSPACES,
    CASSANDRA_GET_TABLE_COLUMNS,
)
from metadata.ingestion.source.database.common_nosql_source import (
    CommonNoSQLSource,
    TableNameAndType,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class CassandraSource(CommonNoSQLSource):
    """
    Implements the necessary methods to extract
    Database metadata from Dynamo Source
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.cassandra = self.connection_obj

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: CassandraConnection = config.serviceConnection.root.config
        if not isinstance(connection, CassandraConnection):
            raise InvalidSourceException(
                f"Expected CassandraConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_schema_name_list(self) -> List[str]:
        """
        Method to get list of schema names available within NoSQL db
        need to be overridden by sources
        """
        schema_names = []
        try:
            schema_names = [
                row.keyspace_name
                for row in self.cassandra.execute(CASSANDRA_GET_KEYSPACES)
            ]
        except Exception as exp:
            logger.debug(f"Failed to list keyspace names: {exp}")
            logger.debug(traceback.format_exc())

        return schema_names

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Method to get list of table names available within schema db
        need to be overridden by sources
        """
        tables = []
        try:
            tables = [
                TableNameAndType(name=row.table_name)
                for row in self.cassandra.execute(
                    CASSANDRA_GET_KEYSPACE_TABLES, [schema_name]
                )
            ]
        except Exception as exp:
            logger.debug(
                f"Failed to list table names for schema [{schema_name}]: {exp}"
            )
            logger.debug(traceback.format_exc())

        return tables

    def query_view_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Method to get list of materialized view names available within schema db
        need to be overridden by sources
        """
        materialized_views = []
        try:
            materialized_views = [
                TableNameAndType(name=row.view_name, type_=TableType.MaterializedView)
                for row in self.cassandra.execute(
                    CASSANDRA_GET_KEYSPACE_MATERIALIZED_VIEWS, [schema_name]
                )
            ]
        except Exception as exp:
            logger.debug(
                f"Failed to list materialized view names for schema [{schema_name}]: {exp}"
            )
            logger.debug(traceback.format_exc())

        return materialized_views

    def get_table_columns(self, schema_name: str, table_name: str) -> List[Column]:
        try:
            data = self.cassandra.execute(
                CASSANDRA_GET_TABLE_COLUMNS, [schema_name, table_name]
            )
            return [CassandraColumnParser.parse(field=field) for field in data]
        except Exception as opf:
            logger.debug(f"Failed to read table [{table_name}]: {opf}")
            logger.debug(traceback.format_exc())

        return []
