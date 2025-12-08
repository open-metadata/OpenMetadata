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

"""Unit tests for ValidationResult."""
from datetime import datetime
from uuid import UUID

import pytest

from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Timestamp
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.data_quality.dataframes.validation_results import ValidationResult


def create_test_case(fqn: str) -> TestCase:
    """Helper to create a test case with minimal required fields."""
    return TestCase(
        name=fqn.split(".")[-1],
        fullyQualifiedName=FullyQualifiedEntityName(fqn),
        testDefinition=EntityReference(
            id=UUID("12345678-1234-1234-1234-123456789abc"),
            type="testDefinition",
            fullyQualifiedName=fqn,
        ),
        entityLink="<#E::table::test_table>",
        testSuite=EntityReference(
            id=UUID("87654321-4321-4321-4321-cba987654321"),
            type="testSuite",
            fullyQualifiedName="test_suite",
        ),
    )


def create_test_result(
    status: TestCaseStatus,
    passed_rows: int = 0,
    failed_rows: int = 0,
) -> TestCaseResult:
    """Helper to create a test case result."""
    total = passed_rows + failed_rows
    return TestCaseResult(
        timestamp=Timestamp(int(datetime.now().timestamp() * 1000)),
        testCaseStatus=status,
        passedRows=passed_rows if total > 0 else None,
        failedRows=failed_rows if total > 0 else None,
        passedRowsPercentage=(passed_rows / total * 100) if total > 0 else None,
        failedRowsPercentage=(failed_rows / total * 100) if total > 0 else None,
    )


class TestValidationResultMerge:
    """Test ValidationResult.merge method."""

    def test_merge_single_result(self) -> None:
        """Test merging a single ValidationResult returns equivalent result."""
        test_case = create_test_case("test.case.one")
        test_result = create_test_result(TestCaseStatus.Success, passed_rows=100)

        result = ValidationResult(
            success=True,
            total_tests=1,
            passed_tests=1,
            failed_tests=0,
            test_cases_and_results=[(test_case, test_result)],
            execution_time_ms=10.0,
        )

        merged = ValidationResult.merge(result)

        assert merged.success is True
        assert merged.total_tests == 1
        assert merged.passed_tests == 1
        assert merged.failed_tests == 0
        assert merged.execution_time_ms == 10.0
        assert len(merged.test_cases_and_results) == 1

    def test_merge_multiple_results_same_test_case(self) -> None:
        """Test merging results for same test case aggregates metrics."""
        test_case = create_test_case("test.case.one")

        result1 = ValidationResult(
            success=True,
            total_tests=1,
            passed_tests=1,
            failed_tests=0,
            test_cases_and_results=[
                (test_case, create_test_result(TestCaseStatus.Success, passed_rows=50))
            ],
            execution_time_ms=10.0,
        )

        result2 = ValidationResult(
            success=True,
            total_tests=1,
            passed_tests=1,
            failed_tests=0,
            test_cases_and_results=[
                (test_case, create_test_result(TestCaseStatus.Success, passed_rows=30))
            ],
            execution_time_ms=8.0,
        )

        merged = ValidationResult.merge(result1, result2)

        assert merged.success is True
        assert merged.total_tests == 1
        assert merged.passed_tests == 1
        assert merged.failed_tests == 0
        assert merged.execution_time_ms == 18.0
        assert len(merged.test_cases_and_results) == 1

        _, aggregated_result = merged.test_cases_and_results[0]
        assert aggregated_result.passedRows == 80
        assert aggregated_result.failedRows == 0
        assert aggregated_result.testCaseStatus == TestCaseStatus.Success

    def test_merge_aggregates_passed_and_failed_rows(self) -> None:
        """Test that passed and failed rows are summed correctly."""
        test_case = create_test_case("test.case.one")

        result1 = ValidationResult(
            success=False,
            total_tests=1,
            passed_tests=0,
            failed_tests=1,
            test_cases_and_results=[
                (
                    test_case,
                    create_test_result(
                        TestCaseStatus.Failed, passed_rows=40, failed_rows=10
                    ),
                )
            ],
            execution_time_ms=10.0,
        )

        result2 = ValidationResult(
            success=False,
            total_tests=1,
            passed_tests=0,
            failed_tests=1,
            test_cases_and_results=[
                (
                    test_case,
                    create_test_result(
                        TestCaseStatus.Failed, passed_rows=30, failed_rows=20
                    ),
                )
            ],
            execution_time_ms=12.0,
        )

        merged = ValidationResult.merge(result1, result2)

        assert merged.success is False
        assert merged.total_tests == 1
        assert merged.failed_tests == 1
        assert merged.execution_time_ms == 22.0

        _, aggregated_result = merged.test_cases_and_results[0]
        assert aggregated_result.passedRows == 70
        assert aggregated_result.failedRows == 30
        assert aggregated_result.testCaseStatus == TestCaseStatus.Failed
        assert aggregated_result.passedRowsPercentage == pytest.approx(70.0)
        assert aggregated_result.failedRowsPercentage == pytest.approx(30.0)

    def test_merge_multiple_test_cases(self) -> None:
        """Test merging results with multiple different test cases."""
        test_case1 = create_test_case("test.case.one")
        test_case2 = create_test_case("test.case.two")

        result1 = ValidationResult(
            success=True,
            total_tests=2,
            passed_tests=2,
            failed_tests=0,
            test_cases_and_results=[
                (
                    test_case1,
                    create_test_result(TestCaseStatus.Success, passed_rows=50),
                ),
                (
                    test_case2,
                    create_test_result(TestCaseStatus.Success, passed_rows=30),
                ),
            ],
            execution_time_ms=15.0,
        )

        result2 = ValidationResult(
            success=True,
            total_tests=2,
            passed_tests=2,
            failed_tests=0,
            test_cases_and_results=[
                (
                    test_case1,
                    create_test_result(TestCaseStatus.Success, passed_rows=25),
                ),
                (
                    test_case2,
                    create_test_result(TestCaseStatus.Success, passed_rows=35),
                ),
            ],
            execution_time_ms=12.0,
        )

        merged = ValidationResult.merge(result1, result2)

        assert merged.success is True
        assert merged.total_tests == 2
        assert merged.passed_tests == 2
        assert merged.failed_tests == 0
        assert merged.execution_time_ms == 27.0
        assert len(merged.test_cases_and_results) == 2

        fqns_to_results = {
            tc.fullyQualifiedName.root: result
            for tc, result in merged.test_cases_and_results
        }

        assert fqns_to_results["test.case.one"].passedRows == 75
        assert fqns_to_results["test.case.two"].passedRows == 65

    def test_merge_with_failure_status_propagates(self) -> None:
        """Test that if any batch fails, overall status is Failed."""
        test_case = create_test_case("test.case.one")

        result1 = ValidationResult(
            success=True,
            total_tests=1,
            passed_tests=1,
            failed_tests=0,
            test_cases_and_results=[
                (test_case, create_test_result(TestCaseStatus.Success, passed_rows=50))
            ],
            execution_time_ms=10.0,
        )

        result2 = ValidationResult(
            success=False,
            total_tests=1,
            passed_tests=0,
            failed_tests=1,
            test_cases_and_results=[
                (
                    test_case,
                    create_test_result(
                        TestCaseStatus.Failed, passed_rows=20, failed_rows=10
                    ),
                )
            ],
            execution_time_ms=10.0,
        )

        merged = ValidationResult.merge(result1, result2)

        assert merged.success is False
        assert merged.failed_tests == 1

        _, aggregated_result = merged.test_cases_and_results[0]
        assert aggregated_result.testCaseStatus == TestCaseStatus.Failed

    def test_merge_with_aborted_status_takes_precedence(self) -> None:
        """Test that Aborted status takes precedence over Failed."""
        test_case = create_test_case("test.case.one")

        result1 = ValidationResult(
            success=False,
            total_tests=1,
            passed_tests=0,
            failed_tests=1,
            test_cases_and_results=[
                (
                    test_case,
                    create_test_result(
                        TestCaseStatus.Failed, passed_rows=40, failed_rows=10
                    ),
                )
            ],
            execution_time_ms=10.0,
        )

        result2 = ValidationResult(
            success=False,
            total_tests=1,
            passed_tests=0,
            failed_tests=1,
            test_cases_and_results=[
                (test_case, create_test_result(TestCaseStatus.Aborted))
            ],
            execution_time_ms=5.0,
        )

        merged = ValidationResult.merge(result1, result2)

        _, aggregated_result = merged.test_cases_and_results[0]
        assert aggregated_result.testCaseStatus == TestCaseStatus.Aborted

    def test_merge_empty_raises_error(self) -> None:
        """Test that merging with no results raises ValueError."""
        with pytest.raises(ValueError, match="At least one ValidationResult"):
            ValidationResult.merge()

    def test_merge_without_fqn_raises_error(self) -> None:
        """Test that merging test cases without FQN raises ValueError."""
        test_case = TestCase(
            name="test",
            fullyQualifiedName=None,
            testDefinition=EntityReference(
                id=UUID("12345678-1234-1234-1234-123456789abc"),
                type="testDefinition",
                fullyQualifiedName="test.def",
            ),
            entityLink="<#E::table::test_table>",
            testSuite=EntityReference(
                id=UUID("87654321-4321-4321-4321-cba987654321"),
                type="testSuite",
                fullyQualifiedName="test_suite",
            ),
        )

        result = ValidationResult(
            success=True,
            total_tests=1,
            passed_tests=1,
            failed_tests=0,
            test_cases_and_results=[
                (test_case, create_test_result(TestCaseStatus.Success))
            ],
            execution_time_ms=10.0,
        )

        with pytest.raises(ValueError, match="no fullyQualifiedName"):
            ValidationResult.merge(result)

    def test_merge_preserves_test_case_reference(self) -> None:
        """Test that the merged result contains the original test case reference."""
        test_case = create_test_case("test.case.one")

        result1 = ValidationResult(
            success=True,
            total_tests=1,
            passed_tests=1,
            failed_tests=0,
            test_cases_and_results=[
                (test_case, create_test_result(TestCaseStatus.Success, passed_rows=50))
            ],
            execution_time_ms=10.0,
        )

        result2 = ValidationResult(
            success=True,
            total_tests=1,
            passed_tests=1,
            failed_tests=0,
            test_cases_and_results=[
                (test_case, create_test_result(TestCaseStatus.Success, passed_rows=30))
            ],
            execution_time_ms=8.0,
        )

        merged = ValidationResult.merge(result1, result2)

        merged_test_case, _ = merged.test_cases_and_results[0]
        assert merged_test_case.fullyQualifiedName.root == "test.case.one"
        assert merged_test_case.name.root == "one"
