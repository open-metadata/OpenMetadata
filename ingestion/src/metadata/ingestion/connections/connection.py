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
BaseConnection abstract class for database connectors.

This module defines the BaseConnection abstract base class,
which provides a common, type-safe interface for all database connection implementations.
Each connector subclass should inherit from BaseConnection and implement the required abstract methods
to provide a unified way to instantiate and interact with different data sources.
"""

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Callable, Generic, TypeVar

if TYPE_CHECKING:
    from pyspark.sql import DataFrame, SparkSession


S = TypeVar("S")  # ServiceConnection Type
C = TypeVar("C")  # Client Type


class BaseConnection(ABC, Generic[S, C]):
    """
    Abstract base class for database connections, providing a unified interface
    for service connection and client/engine access across different data sources.
    """

    service_connection: S

    def __init__(self, service_connection: S) -> None:
        self.service_connection = service_connection

    @abstractmethod
    def get_spark_dataframe_loader(
        self, spark: "SparkSession", table: str
    ) -> Callable[..., "DataFrame"]:
        """
        Return a callable that loads a Spark DataFrame for this connection.
        The callable's signature can be further specified in subclasses.
        """

    @abstractmethod
    def get_client(self) -> C:
        """
        Return the main client/engine/connection object for this service.
        """
