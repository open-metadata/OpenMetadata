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
Query Parser Source module. Parent class for Lineage & Usage workflows
"""
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Iterator, Optional

from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.steps import Source
from metadata.ingestion.connections.test_connections import (
    raise_test_connection_exception,
)
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_test_connection_fn
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import get_ssl_connection

logger = ingestion_logger()


class QueryParserSource(Source, ABC):
    """
    Core class to be inherited for sources that
    parse query logs, be it for usage or lineage.

    It leaves the implementation of the `_iter`
    from the Source to its children, while providing
    some utilities to be overwritten when necessary
    """

    sql_stmt: str
    dialect: str
    filters: str
    database_field: str
    schema_field: str

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
        get_engine: bool = True,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        connection_type = self.service_connection.type.value
        self.dialect = ConnectionTypeDialectMapper.dialect_of(connection_type)
        self.source_config = self.config.sourceConfig.config
        self.start, self.end = get_start_and_end(self.source_config.queryLogDuration)
        self.engine = (
            get_ssl_connection(self.service_connection) if get_engine else None
        )

    @property
    def name(self) -> str:
        return self.service_connection.type.name

    def prepare(self):
        """By default, there's nothing to prepare"""

    @abstractmethod
    def get_table_query(self) -> Iterator[TableQuery]:
        """Overwrite to load table queries from log files"""

    @staticmethod
    def get_database_name(data: dict) -> str:
        return data.get("database_name")

    @staticmethod
    def get_schema_name(data: dict) -> str:
        return data.get("schema_name")

    @staticmethod
    def get_aborted_status(data: dict) -> bool:
        return data.get("aborted", False)

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        """
        returns sql statement to fetch query logs.

        Override if we have specific parameters
        """
        return self.sql_stmt.format(
            start_time=start_time,
            end_time=end_time,
            filters=self.get_filters(),
            result_limit=self.source_config.resultLimit,
        )

    def check_life_cycle_query(
        self,
        query_type: Optional[str],  # pylint: disable=unused-argument
        query_text: Optional[str],  # pylint: disable=unused-argument
    ) -> bool:
        """
        returns true if query is to be used for life cycle processing.

        Override if we have specific parameters
        """
        return False

    def get_filters(self) -> str:
        if self.source_config.filterCondition:
            return f"{self.filters} AND {self.source_config.filterCondition}"
        return self.filters

    def get_engine(self):
        yield self.engine

    def close(self):
        """By default, there is nothing to close"""

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        result = test_connection_fn(self.engine)
        raise_test_connection_exception(result)
