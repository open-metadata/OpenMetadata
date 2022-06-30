#  Copyright 2022 Collate
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
Base table test builder handlers
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict

from metadata.generated.schema.api.tests.createTableTest import CreateTableTestRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.tableTest import TableTestCase
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class BaseTableTestBuilder(ABC):
    """Base class for the table test builder. This is used to send
    Great Expectations test results to OMeta
    """

    def __init__(self):
        self.result = None
        self.ometa_conn = None
        self.table_entity = None
        self.timestamp = None

    def __call__(
        self, result: Dict, ometa_conn: OpenMetadata, table_entity: Table
    ) -> None:
        """Used to update instance attribute value as instance builders
        are only defined once in the Enum class

        Args:
            result: single result for a GE test result
            ometa_conn: OMeta API connection
            table_entity: table entity for the test
        """
        self.result = result
        self.ometa_conn = ometa_conn
        self.table_entity = table_entity
        self.timestamp = Timestamp(__root__=int(int(datetime.now().timestamp())))

    def add_test(self) -> None:
        """Send an API request to add a test result to a table entity"""
        self.ometa_conn.add_table_test(self.table_entity, self._build_test())

    @staticmethod
    def build_test_case(config, test_type) -> TableTestCase:
        """Build test case based on the test type

        Args:
            config: any instance of a column test case
            test_type: any instance of a column test type
        Return:
            ColumnTestCase
        """
        return TableTestCase(
            config=config,
            tableTestType=test_type,
        )

    def build_test_case_results(self) -> TestCaseResult:
        """Build test case result base on GE test result"""
        return TestCaseResult(
            executionTime=self.timestamp,
            testCaseStatus=TestCaseStatus.Success
            if self.result["success"]
            else TestCaseStatus.Failed,
            result=self._get_expectation_result(),
        )

    def _get_expectation_result(self):
        """Get the expectation result"""
        if self.result["result"]:
            if isinstance(self.result["result"]["observed_value"], list):
                return ", ".join(self.result["result"].get("observed_value"))
            return self.result["result"]["observed_value"]

        return None

    def build_test_request(self, *, config, test_type) -> CreateTableTestRequest:
        """Build a test case request to add the test to the tabe

        Args:
            test_case: test case
            test_case_result: a test case result
        Return:
            CreateColumnTestRequest
        """
        return CreateTableTestRequest(
            testCase=self.build_test_case(config=config, test_type=test_type),
            result=self.build_test_case_results(),
            updatedAt=self.timestamp,
        )

    @abstractmethod
    def _build_test(self) -> CreateTableTestRequest:
        """Used to create the table test request for the specific test.
        Needs to be implemented by the specific builder.
        """
