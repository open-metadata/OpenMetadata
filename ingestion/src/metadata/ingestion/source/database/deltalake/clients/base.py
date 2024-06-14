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
Deltalake Base Client
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Callable, Iterable, List, Optional

from metadata.generated.schema.entity.data.table import (
    Column,
    PartitionColumnDetails,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.deltaLakeConnection import (
    DeltaLakeConnection,
)


@dataclass
class TableInfo:
    """Small Class to store TableInfo from different Clients in the same format."""

    schema: str
    name: str
    _type: TableType
    location: Optional[str] = None
    description: Optional[str] = None
    columns: Optional[List[Column]] = None
    table_partitions: Optional[List[PartitionColumnDetails]] = None


class DeltalakeBaseClient(ABC):
    @classmethod
    @abstractmethod
    def from_config(
        cls, service_connection: DeltaLakeConnection
    ) -> "DeltalakeBaseClient":
        """Returns a Deltalake Client based on the DatalakeConfig passed."""

    @abstractmethod
    def get_database_names(
        self, service_connection: DeltaLakeConnection
    ) -> Iterable[str]:
        """Returns the Database Names, based on the underlying client."""

    @abstractmethod
    def get_database_schema_names(
        self, service_connection: DeltaLakeConnection
    ) -> Iterable[str]:
        """Returns the RAW database schema names, based on the underlying client."""

    @abstractmethod
    def get_table_info(
        self, service_connection: DeltaLakeConnection, schema_name: str
    ) -> Iterable[TableInfo]:
        """Returns the TableInfo, based on the underlying client."""

    @abstractmethod
    def update_table_info(self, table_info: TableInfo) -> TableInfo:
        """Updates TableInfo with extra Metadata that was defered."""

    @abstractmethod
    def close(self, service_connection: DeltaLakeConnection):
        """Closes the Client connection."""

    @abstractmethod
    def get_test_get_databases_fn(self, config) -> Callable:
        """Returns a Callable used to test the GetDatabases condition."""

    @abstractmethod
    def get_test_get_tables_fn(self, config) -> Callable:
        """Returns a Callable used to test the GetTables condition."""
