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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""
from datetime import datetime, timezone
from typing import Optional

from pandas import DataFrame

from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.interfaces.test_suite_protocol import TestSuiteProtocol
from metadata.test_suite.validations.core import validation_enum_registry
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class DataLakeTestSuiteInterface(TestSuiteProtocol):
    """
    Sequential interface protocol for testSuite and Profiler. This class
    implements specific operations needed to run profiler and test suite workflow
    against a Datalake source.
    """

    def __init__(
        self,
        ometa_client: OpenMetadata = None,
        service_connection_config: DatalakeConnection = None,
        table_entity=None,
        data_frame: DataFrame = None,
    ):
        self.table_entity = table_entity
        self.data_frame = data_frame
        self.ometa_client = ometa_client
        self.service_connection_config = service_connection_config

    def run_test_case(
        self,
        test_case: TestCase,
    ) -> Optional[TestCaseResult]:
        """Run table tests where platformsTest=OpenMetadata

        Args:
            test_case: test case object to execute

        Returns:
            TestCaseResult object
        """

        try:
            return validation_enum_registry.registry[
                test_case.testDefinition.fullyQualifiedName
            ](
                self.data_frame,
                test_case=test_case,
                execution_date=datetime.now(tz=timezone.utc).timestamp(),
            )
        except KeyError as err:
            logger.warning(
                f"Test definition {test_case.testDefinition.fullyQualifiedName} not registered in OpenMetadata "
                f"TestDefintion registry. Skipping test case {test_case.name.__root__} - {err}"
            )
            return None
