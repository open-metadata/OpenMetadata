#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""DataFrame validation result models."""

from enum import Enum
from typing import List, Optional, Tuple

from pydantic import BaseModel

from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.sdk import OpenMetadata
from metadata.sdk.data_quality.dataframes.open_metadata import push_validation_results


class FailureMode(Enum):
    SHORT_CIRCUIT = "short-circuit"


class ValidationResult(BaseModel):
    """Aggregated results from validating multiple tests on a DataFrame.

    Attributes:
        success: True if all tests passed
        total_tests: Total number of tests executed
        passed_tests: Number of tests that passed
        failed_tests: Number of tests that failed
        test_results: Individual test results
        execution_time_ms: Total execution time in milliseconds
    """

    success: bool
    total_tests: int
    passed_tests: int
    failed_tests: int
    test_cases_and_results: List[Tuple[TestCase, TestCaseResult]]
    execution_time_ms: float

    @property
    def failures(self) -> List[TestCaseResult]:
        """Get only failed test results.

        Returns:
            List of test results where status is Failed or Aborted
        """
        return [
            result
            for result in self.test_results
            if result.testCaseStatus in (TestCaseStatus.Failed, TestCaseStatus.Aborted)
        ]

    @property
    def passes(self) -> List[TestCaseResult]:
        """Get only passed test results.

        Returns:
            List of test results where status is Success
        """
        return [
            result
            for result in self.test_results
            if result.testCaseStatus == TestCaseStatus.Success
        ]

    @property
    def test_results(self) -> List[TestCaseResult]:
        """Get all test results."""
        return [result for _, result in self.test_cases_and_results]

    def publish_to_openmetadata(
        self, table_fqn: str, client: Optional[OpenMetadata] = None
    ) -> None:
        """Publish test results to OpenMetadata.
        Args:
            table_fqn: Fully qualified table name
            client: OpenMetadata client
        """
        return push_validation_results(table_fqn, self, client=client)
