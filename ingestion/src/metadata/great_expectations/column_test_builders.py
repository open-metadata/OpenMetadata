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
TestCase builder handlers
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict

from metadata.generated.schema.api.tests.createColumnTest import CreateColumnTestRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.column import (
    columnValuesLengthsToBeBetween,
    columnValuesToBeBetween,
    columnValuesToBeNotInSet,
    columnValuesToBeNotNull,
    columnValuesToBeUnique,
    columnValuesToMatchRegex,
)
from metadata.generated.schema.tests.columnTest import ColumnTestCase, ColumnTestType
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class BaseColumnTestBuilder(ABC):
    """Base class for the column test builder. This is used to send
    Great Expectations test results to OMeta
    """

    def __init__(self):
        self.result = None
        self.ometa_conn = None
        self.table_entity = None
        self.timestamp = None

    def __call__(self, result: Dict, ometa_conn: OpenMetadata, table_entity: Table):
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
        self.ometa_conn.add_column_test(self.table_entity, self._build_test())

    @staticmethod
    def build_test_case(config, test_type) -> ColumnTestCase:
        """Build test case based on the test type

        Args:
            config: any instance of a column test case
            test_type: any instance of a column test type
        Return:
            ColumnTestCase
        """
        return ColumnTestCase(
            config=config,
            columnTestType=test_type,
        )

    def build_test_case_results(self) -> TestCaseResult:
        """Build test case result base on GE test result"""
        return TestCaseResult(
            executionTime=self.timestamp,
            testCaseStatus=TestCaseStatus.Success
            if self.result["success"]
            else TestCaseStatus.Failed,
            result="Failing rows percentage: "
            f"{self.result['result']['unexpected_percent']}",
        )

    def built_test_request(
        self,
        *,
        test_case: ColumnTestCase,
        test_case_result: TestCaseResult,
    ) -> CreateColumnTestRequest:
        """Build a test case request to add the test to the tabe

        Args:
            test_case: test case
            test_case_result: a test case result
        Return:
            CreateColumnTestRequest
        """
        return CreateColumnTestRequest(
            columnName=self.result["expectation_config"]["kwargs"]["column"],
            testCase=test_case,
            result=test_case_result,
            updatedAt=self.timestamp,
        )

    @abstractmethod
    def _build_test(self) -> CreateColumnTestRequest:
        """Used to create the column test request for the specific test.
        Needs to be implemented by the specific builder.
        """


class ColumnValuesLengthsToBeBetweenBuilder(BaseColumnTestBuilder):
    """Builder for `expect_column_value_lengths_to_be_between` GE expectation"""

    def _build_test(self) -> CreateColumnTestRequest:
        """Specific test builder for the test"""
        return self.built_test_request(
            test_case=self.build_test_case(
                config=columnValuesLengthsToBeBetween.ColumnValueLengthsToBeBetween(
                    minLength=self.result["expectation_config"]["kwargs"].get(
                        "min_value"
                    ),
                    maxLength=self.result["expectation_config"]["kwargs"].get(
                        "max_value"
                    ),
                ),
                test_type=ColumnTestType.columnValueLengthsToBeBetween,
            ),
            test_case_result=self.build_test_case_results(),
        )


class ColumnValuesToBeBetweenBuilder(BaseColumnTestBuilder):
    """Builder for `expect_column_value_to_be_between` GE expectation"""

    def _build_test(self) -> CreateColumnTestRequest:
        """Specific test builder for the test"""
        return self.built_test_request(
            test_case=self.build_test_case(
                config=columnValuesToBeBetween.ColumnValuesToBeBetween(
                    minValue=self.result["expectation_config"]["kwargs"].get(
                        "max_value"
                    ),
                    maxValue=self.result["expectation_config"]["kwargs"].get(
                        "min_value"
                    ),
                ),
                test_type=ColumnTestType.columnValuesToBeBetween,
            ),
            test_case_result=self.build_test_case_results(),
        )


class ColumnValuesToBeNotInSetBuilder(BaseColumnTestBuilder):
    """Builder for `expect_column_values_to_not_be_in_set` GE expectation"""

    def _build_test(self) -> CreateColumnTestRequest:
        """Specific test builder for the test"""
        return self.built_test_request(
            test_case=self.build_test_case(
                config=columnValuesToBeNotInSet.ColumnValuesToBeNotInSet(
                    forbiddenValues=self.result["expectation_config"]["kwargs"][
                        "value_set"
                    ],
                ),
                test_type=ColumnTestType.columnValuesToBeNotInSet,
            ),
            test_case_result=self.build_test_case_results(),
        )


class ColumnValuesToBeNotNullBuilder(BaseColumnTestBuilder):
    """Builder for `expect_column_values_to_not_be_null` GE expectation"""

    def _build_test(self) -> CreateColumnTestRequest:
        """Specific test builder for the test"""
        return self.built_test_request(
            test_case=self.build_test_case(
                config=columnValuesToBeNotNull.ColumnValuesToBeNotNull(),
                test_type=ColumnTestType.columnValuesToBeNotNull,
            ),
            test_case_result=self.build_test_case_results(),
        )


class ColumnValuesToBeUniqueBuilder(BaseColumnTestBuilder):
    """Builder for `expect_column_values_to_be_unique` GE expectation"""

    def _build_test(self) -> CreateColumnTestRequest:
        """Specific test builder for the test"""
        return self.built_test_request(
            test_case=self.build_test_case(
                config=columnValuesToBeUnique.ColumnValuesToBeUnique(),
                test_type=ColumnTestType.columnValuesToBeUnique,
            ),
            test_case_result=self.build_test_case_results(),
        )


class ColumnValuesToMatchRegexBuilder(BaseColumnTestBuilder):
    """Builder for `expect_column_values_to_match_regex` GE expectation"""

    def _build_test(self) -> CreateColumnTestRequest:
        """Specific test builder for the test"""
        return self.built_test_request(
            test_case=self.build_test_case(
                config=columnValuesToMatchRegex.ColumnValuesToMatchRegex(
                    regex=self.result["expectation_config"]["kwargs"]["regex"],
                ),
                test_type=ColumnTestType.columnValuesToMatchRegex,
            ),
            test_case_result=self.build_test_case_results(),
        )
