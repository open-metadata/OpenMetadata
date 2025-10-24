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

from dataclasses import dataclass
from typing import List, Optional

from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus


@dataclass
class TestValidationResult:
    """Result of validating a single test case on a DataFrame.

    Attributes:
        test_name: Name of the test case
        test_type: Type of test (e.g., 'columnValuesToBeNotNull')
        status: Status of the test execution
        passed_rows: Number of rows that passed validation
        failed_rows: Number of rows that failed validation
        total_rows: Total number of rows in the DataFrame
        failed_row_indices: Optional list of row indices that failed
        result_message: Human-readable result message
        test_case_result: Full TestCaseResult object from validator
    """

    test_name: str
    test_type: str
    status: TestCaseStatus
    passed_rows: int
    failed_rows: int
    total_rows: int
    failed_row_indices: Optional[List[int]]
    result_message: str
    test_case_result: TestCaseResult


@dataclass
class ValidationResult:
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
    test_results: List[TestValidationResult]
    execution_time_ms: float

    @property
    def failures(self) -> List[TestValidationResult]:
        """Get only failed test results.

        Returns:
            List of test results where status is Failed or Aborted
        """
        return [
            result
            for result in self.test_results
            if result.status in (TestCaseStatus.Failed, TestCaseStatus.Aborted)
        ]

    @property
    def passes(self) -> List[TestValidationResult]:
        """Get only passed test results.

        Returns:
            List of test results where status is Success
        """
        return [
            result
            for result in self.test_results
            if result.status == TestCaseStatus.Success
        ]
