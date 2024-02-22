#  Copyright 2024 Collate
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
factory for NoSQL adaptors that are used in the NoSQLProfiler.
"""
from enum import Enum
from typing import Callable, Dict, Type

from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBType,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.profiler.adaptors.mongodb import MongoDB
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor
from metadata.utils.logger import profiler_logger

NoSQLAdaptorConstructor = Callable[[any], NoSQLAdaptor]

logger = profiler_logger()


class NoSQLAdaptorFactory:
    """
    A factory class for creating NoSQL client instances.

    This class maintains a registry of callable constructors for different NoSQL client types.
    The client types are registered with their corresponding constructors,
    and can be created using the `construct` method.

    Attributes:
        _clients (Dict[str, NoSQLClientConstructor]): A dictionary mapping client type names to their constructors.

    Methods:
        register(source_class: Type, target_class: NoSQLClientConstructor): Register a client type with its constructor.
        construct(source_client: any) -> NoSQLClient: Create a client instance of the type of the given source client.
    """

    def __init__(self):
        """
        Initialize a new instance of NoSQLClientFactory.
        """
        self._clients: Dict[str, NoSQLAdaptorConstructor] = {}

    def register(self, source_connection: Enum, target_class: NoSQLAdaptorConstructor):
        """
        Register a client type with its constructor.

        Args:
            source_connection (str): The name of the source client type.
            target_class (NoSQLClientConstructor): The constructor for the target client.

        Returns:
            None
        """
        self._clients[source_connection.value.lower()] = target_class

    def construct(self, source_connection: Enum, connection: any) -> NoSQLAdaptor:
        """
        Create a client instance of the type of the given source client.

        Args:
            source_connection (Type): The class of the source client.
            connection (any): The source client instance.

        Returns:
            NoSQLAdaptor: The created client instance.

        Raises:
            ValueError: If the type of the source client is not registered.
        """
        logger.debug(f"Creating NoSQL client for {source_connection}")
        client_class = self._clients.get(source_connection.value.lower())
        if not client_class:
            raise ValueError(f"Unknown NoSQL source: {source_connection}")
        logger.debug(f"Using NoSQL client constructor: {client_class.__name__}")
        return client_class(connection)


factory = NoSQLAdaptorFactory()
factory.register(MongoDBType.MongoDB, MongoDB)
