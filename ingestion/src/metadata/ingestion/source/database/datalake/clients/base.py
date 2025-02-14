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
Datalake Base Client
"""
from abc import ABC, abstractmethod
from typing import Any, Callable, Iterable, Optional


class DatalakeBaseClient(ABC):
    """Base DL client implementation"""

    def __init__(self, client: Any, **kwargs):
        self._client = client

    @property
    def client(self) -> Any:
        return self._client

    @classmethod
    @abstractmethod
    def from_config(cls, config) -> "DatalakeBaseClient":
        """Returns a Datalake Client based on the DatalakeConfig passed."""

    @abstractmethod
    def update_client_database(self, config, database_name: str):
        """Updates the Client when changing the Database."""

    @abstractmethod
    def get_database_names(self, service_connection) -> Iterable[str]:
        """Returns the Database Names, based on the underlying client."""

    @abstractmethod
    def get_database_schema_names(self, bucket_name: Optional[str]) -> Iterable[str]:
        """Returns the RAW database schema names, based on the underlying client."""

    @abstractmethod
    def get_table_names(self, bucket_name: str, prefix: Optional[str]) -> Iterable[str]:
        """Returns the Table names, based on the underlying client."""

    @abstractmethod
    def close(self, service_connection):
        """Closes the Client connection."""

    @abstractmethod
    def get_test_list_buckets_fn(self, bucket_name: Optional[str]) -> Callable:
        """Returns a Callable used to test the ListBuckets condition."""
