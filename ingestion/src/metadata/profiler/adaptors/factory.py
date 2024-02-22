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
from typing import Callable, Dict, Type

from pymongo import MongoClient

from metadata.profiler.adaptors.mongodb import MongoDB
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor

NoSQLAdaptorConstructor = Callable[[any], NoSQLAdaptor]


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

    def register(self, source_class: Type, target_class: NoSQLAdaptorConstructor):
        """
        Register a client type with its constructor.

        Args:
            source_class (Type): The class of the source client.
            target_class (NoSQLClientConstructor): The constructor for the target client.

        Returns:
            None
        """
        self._clients[source_class.__name__] = target_class

    def construct(self, source_client: any) -> NoSQLAdaptor:
        """
        Create a client instance of the type of the given source client.

        Args:
            source_client (any): The source client instance.

        Returns:
            NoSQLAdaptor: The created client instance.

        Raises:
            ValueError: If the type of the source client is not registered.
        """
        client_class = self._clients.get(type(source_client).__name__)
        if not client_class:
            raise ValueError(f"Unknown NoSQL source: {source_client.__name__}")
        return client_class(source_client)


factory = NoSQLAdaptorFactory()
factory.register(MongoClient, MongoDB)
