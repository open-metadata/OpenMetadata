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

from metadata.data_quality.interface.test_suite_protocol import \
    TestSuiteProtocol
from metadata.data_quality.validations.validator import Validator
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import \
    DatalakeConnection
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import TestDefinition
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.mixins.pandas.pandas_mixin import PandasInterfaceMixin
from metadata.utils.importer import import_test_case_class
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class PandasTestSuiteInterface(TestSuiteProtocol, PandasInterfaceMixin):
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
        df=None,
    ):
        self.table_entity = table_entity
        self.df = df
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
            TestHandler = import_test_case_class(  # pylint: disable=invalid-name
                self.ometa_client.get_by_id(
                    TestDefinition, test_case.testDefinition.id
                ).entityType.value,
                "pandas",
                test_case.testDefinition.fullyQualifiedName,
            )

            test_handler = TestHandler(
                self.df,
                test_case=test_case,
                execution_date=datetime.now(tz=timezone.utc).timestamp(),
            )

            return Validator(validator_obj=test_handler).validate()
        except Exception as err:
            logger.error(
                f"Error executing {test_case.testDefinition.fullyQualifiedName} - {err}"
            )

            raise RuntimeError(err)
