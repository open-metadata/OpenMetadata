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
Factory class for creating profiler interface objects
"""

from typing import cast

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.connections.database.singleStoreConnection import (
    SingleStoreConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.profiler.interface.pandas.profiler_interface import (
    PandasProfilerInterface,
)
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.profiler.interface.sqlalchemy.bigquery.profiler_interface import (
    BigQueryProfilerInterface,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.interface.sqlalchemy.single_store.profiler_interface import (
    SingleStoreProfilerInterface,
)
from metadata.profiler.interface.sqlalchemy.snowflake.profiler_interface import (
    SnowflakeProfilerInterface,
)
from metadata.profiler.interface.sqlalchemy.trino.profiler_interface import (
    TrinoProfilerInterface,
)


class ProfilerInterfaceFactory:
    """Creational factory for profiler interface objects"""

    def __init__(self):
        self._interface_type = {}

    def register(self, interface_type: str, interface_class):
        """Register a new interface"""
        self._interface_type[interface_type] = interface_class

    def create(self, interface_type: str, *args, **kwargs):
        """Create interface object based on interface type"""
        interface_class = self._interface_type.get(interface_type)
        if not interface_class:
            interface_class = self._interface_type.get(DatabaseConnection.__name__)
        interface_class = cast(ProfilerInterface, interface_class)
        return interface_class.create(*args, **kwargs)


profiler_interface_factory = ProfilerInterfaceFactory()
profiler_interface_factory.register(DatabaseConnection.__name__, SQAProfilerInterface)
profiler_interface_factory.register(
    BigQueryConnection.__name__, BigQueryProfilerInterface
)
profiler_interface_factory.register(
    SingleStoreConnection.__name__, SingleStoreProfilerInterface
)
profiler_interface_factory.register(
    DatalakeConnection.__name__, PandasProfilerInterface
)
profiler_interface_factory.register(
    SnowflakeConnection.__name__, SnowflakeProfilerInterface
)
profiler_interface_factory.register(TrinoConnection.__name__, TrinoProfilerInterface)
