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
import logging
from enum import Enum
from typing import List, Optional, Tuple, cast

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.sdk import OpenMetadata
from metadata.sdk import client as get_client
from metadata.sdk.data_quality.dataframes.models import MockTestCase
from metadata.utils.entity_link import (
    get_entity_link,  # pyright: ignore[reportUnknownVariableType]
)
from metadata.utils.entity_link import get_column_name_or_none

logger = logging.getLogger(__name__)


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

    def publish(self, table_fqn: str, client: Optional[OpenMetadata] = None) -> None:
        """Publish test results to OpenMetadata.
        Args:
            table_fqn: Fully qualified table name
            client: OpenMetadata client
        """
        if client is None:
            client = get_client()

        metadata = client.ometa

        for test_case, result in self.test_cases_and_results:
            if isinstance(test_case, MockTestCase):
                test_case = metadata.get_or_create_test_case(
                    test_case_fqn=f"{table_fqn}.{test_case.name.root}",
                    entity_link=get_entity_link(
                        Table,
                        table_fqn,
                        column_name=get_column_name_or_none(test_case.entityLink.root),
                    ),
                    test_definition_fqn=test_case.testDefinition.fullyQualifiedName,
                    test_case_parameter_values=test_case.parameterValues,
                    description=getattr(test_case.description, "root", None),
                )

            res = metadata.add_test_case_results(
                result,
                cast(FullyQualifiedEntityName, test_case.fullyQualifiedName).root,
            )

            logger.debug(f"Result: {res}")

    @classmethod
    def merge(cls, *results: "ValidationResult") -> "ValidationResult":
        """Merge multiple ValidationResult objects into one.

        Aggregates results from multiple validation runs, useful when validating
        DataFrames in batches. When the same test case is run multiple times across
        batches, results are aggregated by test case FQN.

        Args:
            *results: Variable number of ValidationResult objects to merge

        Returns:
            A new ValidationResult with aggregated test case results

        Raises:
            ValueError: If no results are provided to merge
        """
        if not results:
            raise ValueError("At least one ValidationResult must be provided to merge")

        from collections import defaultdict

        aggregated_results: dict[
            str, List[Tuple[TestCase, TestCaseResult]]
        ] = defaultdict(list)
        total_execution_time = 0.0

        for result in results:
            for test_case, test_result in result.test_cases_and_results:
                fqn = test_case.fullyQualifiedName
                if fqn is None:
                    raise ValueError(
                        "Cannot merge results with test cases that have no fullyQualifiedName"
                    )
                aggregated_results[str(fqn)].append((test_case, test_result))
            total_execution_time += result.execution_time_ms

        merged_test_cases_and_results: List[Tuple[TestCase, TestCaseResult]] = []
        for fqn, test_cases_and_results_for_fqn in aggregated_results.items():
            test_case = test_cases_and_results_for_fqn[0][0]
            results_for_test = [result for _, result in test_cases_and_results_for_fqn]

            merged_result = cls._aggregate_test_case_results(results_for_test)
            merged_test_cases_and_results.append((test_case, merged_result))

        total = len(merged_test_cases_and_results)
        passed = sum(
            1
            for _, test_result in merged_test_cases_and_results
            if test_result.testCaseStatus is TestCaseStatus.Success
        )
        failed = total - passed

        return cls(
            success=failed == 0,
            total_tests=total,
            passed_tests=passed,
            failed_tests=failed,
            test_cases_and_results=merged_test_cases_and_results,
            execution_time_ms=total_execution_time,
        )

    @staticmethod
    def _aggregate_test_case_results(
        results: List[TestCaseResult],
    ) -> TestCaseResult:
        """Aggregate multiple TestCaseResult objects for the same test case.

        Combines metrics from multiple test runs by summing passed/failed rows
        and determining overall status.

        Args:
            results: List of TestCaseResult objects from different batch runs

        Returns:
            A single aggregated TestCaseResult
        """
        if not results:
            raise ValueError("At least one TestCaseResult must be provided")

        if len(results) == 1:
            return results[0]

        total_passed_rows = sum(r.passedRows or 0 for r in results)
        total_failed_rows = sum(r.failedRows or 0 for r in results)
        total_rows = total_passed_rows + total_failed_rows

        passed_rows_percentage = (
            (total_passed_rows / total_rows * 100) if total_rows > 0 else None
        )
        failed_rows_percentage = (
            (total_failed_rows / total_rows * 100) if total_rows > 0 else None
        )

        overall_status = TestCaseStatus.Success
        if any(r.testCaseStatus == TestCaseStatus.Aborted for r in results):
            overall_status = TestCaseStatus.Aborted
        elif any(r.testCaseStatus == TestCaseStatus.Failed for r in results):
            overall_status = TestCaseStatus.Failed

        first_result = results[0]
        merged_result_messages = [r.result for r in results if r.result]

        return TestCaseResult(
            id=None,
            testCaseFQN=first_result.testCaseFQN,
            timestamp=first_result.timestamp,
            testCaseStatus=overall_status,
            result=(
                "; ".join(merged_result_messages) if merged_result_messages else None
            ),
            sampleData=None,
            testResultValue=None,
            passedRows=total_passed_rows if total_rows > 0 else None,
            failedRows=total_failed_rows if total_rows > 0 else None,
            passedRowsPercentage=passed_rows_percentage,
            failedRowsPercentage=failed_rows_percentage,
            incidentId=None,
            maxBound=first_result.maxBound,
            minBound=first_result.minBound,
            testCase=first_result.testCase,
            testDefinition=first_result.testDefinition,
            dimensionResults=None,
        )
