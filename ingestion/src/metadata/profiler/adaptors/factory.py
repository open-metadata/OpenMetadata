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
from typing import Callable

from metadata.generated.schema.entity.services.connections.database.dynamoDBConnection import (
    DynamoDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection,
)
from metadata.profiler.adaptors.dynamodb import DynamoDB
from metadata.profiler.adaptors.mongodb import MongoDB
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor
from metadata.profiler.factory import Factory

NoSQLAdaptorConstructor = Callable[[any], NoSQLAdaptor]


class NoSQLAdaptorFactory(Factory):
    """
    A factory class for creating NoSQL client instances.

    This class maintains a registry of callable constructors for different NoSQL client types.
    The client types are registered with their corresponding constructors,
    and can be created using the `construct` method.
    """

    def register(self, interface_type: str, interface_class: NoSQLAdaptorConstructor):
        """
        Register a client type with its constructor.

        Args:
            source_class_name (str): The class of the source client.
            target_class (NoSQLClientConstructor): The constructor for the target client.

        Returns:
            None
        """
        self._interface_type[interface_type] = interface_class

    def create(self, interface_type: any, *args, **kwargs) -> NoSQLAdaptor:
        """
        Create a client instance of the type of the given source client.

        Args:
            interface_type (str): The type of the source connection.

        Returns:
            NoSQLAdaptor: The created client instance.

        Raises:
            ValueError: If the type of the source client is not registered.
        """
        client_class = self._interface_type.get(interface_type)
        if not client_class:
            raise ValueError(f"Unknown NoSQL source: {interface_type}")
        return client_class(*args, **kwargs)


factory = NoSQLAdaptorFactory()
adaptors = {
    MongoDBConnection.__name__: MongoDB,
    DynamoDBConnection.__name__: DynamoDB,
}
factory.register_many(adaptors)
