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
#  pylint: disable=import-outside-toplevel
"""
Interface factory
"""
import traceback
from logging import Logger
from typing import Callable, Dict, Type

from metadata.data_quality.interface.test_suite_interface import TestSuiteInterface
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import test_suite_logger

logger: Logger = test_suite_logger()


class TestSuiteInterfaceFactory:
    """Factory class for the data quality interface"""

    def __init__(self):
        """Initialize the interface factory"""
        self._interface_type: Dict[str, Callable[[], Type[TestSuiteInterface]]] = {
            "base": self.sqa,
        }

    def register(self, interface_type: str, fn: Callable[[], Type[TestSuiteInterface]]):
        """Register the interface

        Args:
            interface_type (str): type of the interface
            interface (callable): a class that implements the TestSuiteInterface
        """
        self._interface_type[interface_type] = fn

    def register_many(self, interface_dict):
        """
        Registers multiple profiler interfaces at once.

        Args:
            interface_dict: A dictionary mapping connection class names (strings) to their
            corresponding profiler interface classes.
        """
        for interface_type, interface_fn in interface_dict.items():
            self.register(interface_type, interface_fn)

    def create(
        self,
        service_connection_config: DatabaseConnection,
        ometa_client: OpenMetadata,
        table_entity: Table,
        *args,
        **kwargs,
    ) -> TestSuiteInterface:
        """Create the interface

        Args:
            service_connection_config (DatabaseService): a database service object

        Raises:
            AttributeError: if no connection is found in the database service object

        Returns:
            TestSuiteInterface:
        """
        try:
            connection_type = service_connection_config.__class__.__name__
        except AttributeError as err:
            logger.debug(traceback.format_exc())
            raise AttributeError(f"Could not instantiate interface class: {err}")
        interface_fn = self._interface_type.get(connection_type)

        if not interface_fn:
            interface_fn = self._interface_type["base"]

        interface_class = interface_fn()
        return interface_class(
            service_connection_config, ometa_client, table_entity, *args, **kwargs
        )

    @staticmethod
    def sqa() -> Type[TestSuiteInterface]:
        """Lazy load the SQATestSuiteInterface"""
        from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import (
            SQATestSuiteInterface,
        )

        return SQATestSuiteInterface

    @staticmethod
    def pandas() -> Type[TestSuiteInterface]:
        """Lazy load the PandasTestSuiteInterface"""
        from metadata.data_quality.interface.pandas.pandas_test_suite_interface import (
            PandasTestSuiteInterface,
        )

        return PandasTestSuiteInterface

    @staticmethod
    def snowflake() -> Type[TestSuiteInterface]:
        """Lazy load the SnowflakeTestSuiteInterface"""
        from metadata.data_quality.interface.sqlalchemy.snowflake.test_suite_interface import (
            SnowflakeTestSuiteInterface,
        )

        return SnowflakeTestSuiteInterface

    @staticmethod
    def unity_catalog() -> Type[TestSuiteInterface]:
        """Lazy load the UnityCatalogTestSuiteInterface"""
        from metadata.data_quality.interface.sqlalchemy.unity_catalog.test_suite_interface import (
            UnityCatalogTestSuiteInterface,
        )

        return UnityCatalogTestSuiteInterface

    @staticmethod
    def databricks() -> Type[TestSuiteInterface]:
        """Lazy load the DatabricksTestSuiteInterface"""
        from metadata.data_quality.interface.sqlalchemy.databricks.test_suite_interface import (
            DatabricksTestSuiteInterface,
        )

        return DatabricksTestSuiteInterface


test_suite_interface = {
    DatabaseConnection.__name__: TestSuiteInterfaceFactory.sqa,
    DatalakeConnection.__name__: TestSuiteInterfaceFactory.pandas,
    SnowflakeConnection.__name__: TestSuiteInterfaceFactory.snowflake,
    UnityCatalogConnection.__name__: TestSuiteInterfaceFactory.unity_catalog,
    DatabricksConnection.__name__: TestSuiteInterfaceFactory.databricks,
}

test_suite_interface_factory = TestSuiteInterfaceFactory()
test_suite_interface_factory.register_many(test_suite_interface)
