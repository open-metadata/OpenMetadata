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

"""Validate our interface factory creates the expected interface instance"""

from unittest.mock import patch

from pytest import mark

from metadata.data_quality.interface.pandas.pandas_test_suite_interface import (
    PandasTestSuiteInterface,
)
from metadata.data_quality.interface.sqlalchemy.databricks.test_suite_interface import (
    DatabricksTestSuiteInterface,
)
from metadata.data_quality.interface.sqlalchemy.snowflake.test_suite_interface import (
    SnowflakeTestSuiteInterface,
)
from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import (
    SQATestSuiteInterface,
)
from metadata.data_quality.interface.sqlalchemy.unity_catalog.test_suite_interface import (
    UnityCatalogTestSuiteInterface,
)
from metadata.data_quality.interface.test_suite_interface_factory import (
    TestSuiteInterfaceFactory,
    test_suite_interface_factory,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials

MYSQL_CONNECTION_CONFIG = MysqlConnection(
    username="root",
    hostPort="localhost:3306",
)  # type: ignore
DATALAKE_CONNECTION_CONFIG = DatalakeConnection(
    configSource=S3Config(
        securityConfig=AWSCredentials(
            awsRegion="us-east-1",
        )  # type: ignore
    )
)  # type: ignore


@patch(
    "metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface.SQATestSuiteInterface.__init__",
    return_value=None,
)
@patch(
    "metadata.data_quality.interface.pandas.pandas_test_suite_interface.PandasTestSuiteInterface.__init__",
    return_value=None,
)
@mark.parametrize(
    "service_connection_config,expected_interface",
    [
        (MYSQL_CONNECTION_CONFIG, SQATestSuiteInterface),
        (DATALAKE_CONNECTION_CONFIG, PandasTestSuiteInterface),
    ],
)
def test_interface_factory(
    sqa_init, pandas_init, service_connection_config, expected_interface
):
    """Test our interface factory creates the expected interface instance type"""
    interface = test_suite_interface_factory.create(
        service_connection_config=service_connection_config,
        ometa_client=None,  # type: ignore
        table_entity=None,  # type: ignore
    )
    assert interface.__class__ == expected_interface


def test_register_many():
    # Initialize factory

    factory = TestSuiteInterfaceFactory()

    test_suite_interfaces = {
        "base": SQATestSuiteInterface,
        DatalakeConnection.__name__: PandasTestSuiteInterface,
        SnowflakeConnection.__name__: SnowflakeTestSuiteInterface,
        UnityCatalogConnection.__name__: UnityCatalogTestSuiteInterface,
        DatabricksConnection.__name__: DatabricksTestSuiteInterface,
    }

    # Register profiles
    factory.register_many(test_suite_interfaces)

    # Assert all expected interfaces are registered
    expected_interfaces = set(test_suite_interfaces.keys())
    actual_interfaces = set(factory._interface_type.keys())
    assert expected_interfaces == actual_interfaces

    # Assert profiler classes match registered interfaces
    for interface_type, interface_class in test_suite_interfaces.items():
        assert factory._interface_type[interface_type] == interface_class
