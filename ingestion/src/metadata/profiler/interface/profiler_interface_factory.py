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

import importlib
from typing import Dict, cast

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
from metadata.generated.schema.entity.services.connections.database.dynamoDBConnection import (
    DynamoDBConnection,
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
from metadata.profiler.interface.profiler_interface import ProfilerInterface


class ProfilerInterfaceFactory(Factory):
    def create(self, interface_type: str, *args, **kwargs):
        """Create interface object based on interface type"""
        interface_class_path = profiler_class_mapping.get(
            interface_type, profiler_class_mapping[DatabaseConnection.__name__]
        )
        try:
            module_path, class_name = interface_class_path.rsplit(".", 1)
            module = importlib.import_module(module_path)
            profiler_class = getattr(module, class_name)
        except (ImportError, AttributeError) as e:
            raise ImportError(f"Error importing {class_name} from {module_path}: {e}")
        profiler_class = cast(ProfilerInterface, profiler_class)
        return profiler_class.create(*args, **kwargs)


profiler_interface_factory = ProfilerInterfaceFactory()

BASE_PROFILER_PATH = "metadata.profiler.interface"
SQLALCHEMY_PROFILER_PATH = f"{BASE_PROFILER_PATH}.sqlalchemy"
NOSQL_PROFILER_PATH = (
    f"{BASE_PROFILER_PATH}.nosql.profiler_interface.NoSQLProfilerInterface"
)
PANDAS_PROFILER_PATH = (
    f"{BASE_PROFILER_PATH}.pandas.profiler_interface.PandasProfilerInterface"
)

# Configuration for dynamic imports
profiler_class_mapping: Dict[str, str] = {
    DatabaseConnection.__name__: SQLALCHEMY_PROFILER_PATH
    + ".profiler_interface.SQAProfilerInterface",
    BigQueryConnection.__name__: SQLALCHEMY_PROFILER_PATH
    + ".bigquery.profiler_interface.BigQueryProfilerInterface",
    SingleStoreConnection.__name__: SQLALCHEMY_PROFILER_PATH
    + ".single_store.profiler_interface.SingleStoreProfilerInterface",
    DatalakeConnection.__name__: PANDAS_PROFILER_PATH,
    MariaDBConnection.__name__: SQLALCHEMY_PROFILER_PATH
    + ".mariadb.profiler_interface.MariaDBProfilerInterface",
    SnowflakeConnection.__name__: SQLALCHEMY_PROFILER_PATH
    + ".snowflake.profiler_interface.SnowflakeProfilerInterface",
    TrinoConnection.__name__: SQLALCHEMY_PROFILER_PATH
    + ".trino.profiler_interface.TrinoProfilerInterface",
    UnityCatalogConnection.__name__: SQLALCHEMY_PROFILER_PATH
    + ".unity_catalog.profiler_interface.UnityCatalogProfilerInterface",
    DatabricksConnection.__name__: SQLALCHEMY_PROFILER_PATH
    + ".databricks.profiler_interface.DatabricksProfilerInterface",
    Db2Connection.__name__: SQLALCHEMY_PROFILER_PATH
    + ".db2.profiler_interface.DB2ProfilerInterface",
    MongoDBConnection.__name__: NOSQL_PROFILER_PATH,
    DynamoDBConnection.__name__: NOSQL_PROFILER_PATH,
}
