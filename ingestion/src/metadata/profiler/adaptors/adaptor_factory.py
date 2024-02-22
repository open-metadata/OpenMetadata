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

from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection,
)
from metadata.profiler.adaptors.mongodb import MongoDB
from metadata.profiler.factory import Factory
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class NoSQLAdaptorFactory(Factory):
    def create(self, interface_type: str, *args, **kwargs) -> any:
        logger.debug(f"Creating NoSQL client for {interface_type}")
        client_class = self._interface_type.get(interface_type)
        if not client_class:
            raise ValueError(f"Unknown NoSQL source: {interface_type}")
        logger.debug(f"Using NoSQL client constructor: {client_class.__name__}")
        return client_class(*args, **kwargs)


adaptors = profilers = {
    MongoDBConnection.__name__: MongoDB,
}
factory = NoSQLAdaptorFactory()
factory.register_many(adaptors)
