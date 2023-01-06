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
Usage Souce Module
"""
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Iterator, List, Optional, Union

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.ingestion.source.database.common_db_source import SQLSourceStatus
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class QueryParserSource(Source[Union[TableQuery, AddLineageRequest]], ABC):
    """
    Core class to be inherited for sources that
    parse query logs, be it for usage or lineage.

    It leaves the implementation of the `next_record`
    from the Source to its children, while providing
    some utilities to be overwritten when necessary
    """

    sql_stmt: str
    filters: str
    database_field: str
    schema_field: str

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service_connection = self.config.serviceConnection.__root__.config
        self.source_config = self.config.sourceConfig.config
        self.start, self.end = get_start_and_end(self.source_config.queryLogDuration)
        self.report = SQLSourceStatus()
        self.engine = get_connection(self.service_connection)

    def prepare(self):
        """
        Fetch queries only from DB that is ingested in OM
        """
        databases: List[Database] = self.metadata.list_all_entities(
            Database, ["databaseSchemas"], params={"service": self.config.serviceName}
        )
        database_name_list = []
        schema_name_list = []

        for database in databases:
            database_name_list.append(database.name.__root__)
            if self.schema_field and database.databaseSchemas:
                for schema in database.databaseSchemas.__root__:
                    schema_name_list.append(schema.name)

        if self.database_field and database_name_list:
            self.filters += (  # pylint: disable=no-member
                f" AND {self.database_field} IN ('"
                + "','".join(database_name_list)
                + "')"
            )

        if self.schema_field and schema_name_list:
            self.filters += (  # pylint: disable=no-member
                f" AND {self.schema_field} IN ('" + "','".join(schema_name_list) + "')"
            )

    @abstractmethod
    def get_table_query(self) -> Optional[Iterator[TableQuery]]:
        """
        Overwrite to load table queries from log files
        """

    @staticmethod
    def get_database_name(data: dict) -> str:
        """
        Method to get database name
        """
        return data.get("database_name")

    @staticmethod
    def get_schema_name(data: dict) -> str:
        """
        Method to get schema name
        """
        return data.get("schema_name")

    @staticmethod
    def get_aborted_status(data: dict) -> bool:
        """
        Method to get aborted status of query
        """
        return data.get("aborted", False)

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        """
        returns sql statement to fetch query logs.

        Override if we have specific parameters
        """
        return self.sql_stmt.format(
            start_time=start_time,
            end_time=end_time,
            filters=self.filters,  # pylint: disable=no-member
            result_limit=self.source_config.resultLimit,
        )

    def get_report(self):
        """
        get report

        Returns:
        """
        return self.report

    def close(self):
        """
        By default, there is nothing to close
        """

    def get_status(self) -> SourceStatus:
        return self.report

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        test_connection_fn(self.engine)
