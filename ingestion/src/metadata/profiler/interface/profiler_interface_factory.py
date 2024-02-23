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
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.connections.database.db2Connection import (
    Db2Connection,
)
from metadata.generated.schema.entity.services.connections.database.mariaDBConnection import (
    MariaDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection,
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
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.profiler.factory import Factory
from metadata.profiler.interface.nosql.profiler_interface import NoSQLProfilerInterface
from metadata.profiler.interface.pandas.profiler_interface import (
    PandasProfilerInterface,
)
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.profiler.interface.sqlalchemy.bigquery.profiler_interface import (
    BigQueryProfilerInterface,
)
from metadata.profiler.interface.sqlalchemy.databricks.profiler_interface import (
    DatabricksProfilerInterface,
)
from metadata.profiler.interface.sqlalchemy.db2.profiler_interface import (
    DB2ProfilerInterface,
)
from metadata.profiler.interface.sqlalchemy.mariadb.profiler_interface import (
    MariaDBProfilerInterface,
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
from metadata.profiler.interface.sqlalchemy.unity_catalog.profiler_interface import (
    UnityCatalogProfilerInterface,
)


class ProfilerInterfaceFactory(Factory):
    def create(self, interface_type: str, *args, **kwargs):
        """Create interface object based on interface type"""
        interface_class = self._interface_type.get(interface_type)
        if not interface_class:
            interface_class = self._interface_type.get(DatabaseConnection.__name__)
        interface_class = cast(ProfilerInterface, interface_class)
        return interface_class.create(*args, **kwargs)


profiler_interface_factory = ProfilerInterfaceFactory()
profilers = {
    DatabaseConnection.__name__: SQAProfilerInterface,
    BigQueryConnection.__name__: BigQueryProfilerInterface,
    SingleStoreConnection.__name__: SingleStoreProfilerInterface,
    DatalakeConnection.__name__: PandasProfilerInterface,
    MariaDBConnection.__name__: MariaDBProfilerInterface,
    SnowflakeConnection.__name__: SnowflakeProfilerInterface,
    TrinoConnection.__name__: TrinoProfilerInterface,
    UnityCatalogConnection.__name__: UnityCatalogProfilerInterface,
    DatabricksConnection.__name__: DatabricksProfilerInterface,
    Db2Connection.__name__: DB2ProfilerInterface,
    MongoDBConnection.__name__: NoSQLProfilerInterface,
}
profiler_interface_factory.register_many(profilers)
