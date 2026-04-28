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
Datalake Base Client
"""

import re
from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, Iterable, Optional, Tuple  # noqa: UP035


class DatalakeBaseClient(ABC):
    """Base DL client implementation"""

    _ICEBERG_METADATA_RE = re.compile(r"^(.*)/metadata/v(\d+)\.metadata\.json$")

    def _update_iceberg_entry(
        self,
        iceberg_tables: Dict[str, Tuple[int, str, Optional[int]]],  # noqa: UP006, UP045
        name: str,
        size: Optional[int],  # noqa: UP045
    ) -> bool:
        """
        If name matches the Iceberg metadata pattern, update iceberg_tables with
        the highest-version entry and return True. Otherwise return False.
        """
        match = self._ICEBERG_METADATA_RE.match(name)
        if not match:
            return False
        table_dir, version = match.group(1), int(match.group(2))
        existing = iceberg_tables.get(table_dir)
        if existing is None or version > existing[0]:
            iceberg_tables[table_dir] = (version, name, size)
        return True

    def __init__(self, client: Any, session: Any = None, **kwargs):
        self._client = client
        self._session = session

    @property
    def client(self) -> Any:
        return self._client

    @property
    def session(self) -> Any:
        return self._session

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
    def get_database_schema_names(self, bucket_name: Optional[str]) -> Iterable[str]:  # noqa: UP045
        """Returns the RAW database schema names, based on the underlying client."""

    @abstractmethod
    def get_table_names(
        self,
        bucket_name: str,
        prefix: Optional[str],  # noqa: UP045
        skip_cold_storage: bool = False,
    ) -> Iterable[Tuple[str, Optional[int]]]:  # noqa: UP006, UP045
        """Returns (key, file_size_bytes) tuples. Size may be None if unavailable."""

    @abstractmethod
    def close(self, service_connection):
        """Closes the Client connection."""

    @abstractmethod
    def get_test_list_buckets_fn(self, bucket_name: Optional[str]) -> Callable:  # noqa: UP045
        """Returns a Callable used to test the ListBuckets condition."""
