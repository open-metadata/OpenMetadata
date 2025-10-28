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
from typing import List

from pydantic import BaseModel

from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus


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
    test_results: List[TestCaseResult]
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
