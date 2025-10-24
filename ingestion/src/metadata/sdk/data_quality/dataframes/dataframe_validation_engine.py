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

"""Orchestration engine for DataFrame validation execution."""

import time
import traceback
from typing import List

from pandas import DataFrame

from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.sdk.data_quality.dataframes import TestValidationResult
from metadata.sdk.data_quality.dataframes.dataframe_validator import FailureMode
from metadata.sdk.data_quality.dataframes.dataframe_validator_adapter import (
    DataFrameValidatorAdapter,
)
from metadata.sdk.data_quality.dataframes.validation_results import ValidationResult


class DataFrameValidationEngine:
    """Orchestrates execution of multiple validators on a DataFrame."""

    def __init__(self, test_definitions: List[TestCaseDefinition]):
        self.test_definitions: List[TestCaseDefinition] = test_definitions

    def execute(
        self,
        df: DataFrame,
        mode: FailureMode = FailureMode.ShortCircuit,
    ) -> ValidationResult:
        """Execute all validations and return aggregated results.

        Args:
            df: DataFrame to validate
            mode: Validation mode (only "short-circuit" supported)

        Returns:
            ValidationResult with outcomes for all tests
        """
        results: List[TestValidationResult] = []
        start_time = time.time()

        for test_def in self.test_definitions:
            try:
                test_result = self._execute_single_test(df, test_def)
                results.append(test_result)

                if mode is FailureMode.ShortCircuit and test_result.status in (
                    TestCaseStatus.Failed,
                    TestCaseStatus.Aborted,
                ):
                    break

            except Exception as exc:
                aborted_result = self._create_aborted_result(test_def, exc)
                results.append(aborted_result)

                if mode is FailureMode.ShortCircuit:
                    break

        execution_time = (time.time() - start_time) * 1000
        return self._build_validation_result(results, execution_time)

    def _execute_single_test(
        self, df: DataFrame, test_definition: TestCaseDefinition
    ) -> TestValidationResult:
        """Execute a single test via adapter.

        Args:
            df: DataFrame to validate
            test_definition: Test configuration

        Returns:
            TestValidationResult for this test
        """
        adapter = DataFrameValidatorAdapter(df, test_definition)
        return adapter.run_validation()

    def _create_aborted_result(
        self, test_definition: TestCaseDefinition, exception: Exception
    ) -> TestValidationResult:
        """Create aborted result for failed test execution.

        Args:
            test_definition: Test that failed to execute
            exception: Exception that occurred

        Returns:
            TestValidationResult marked as aborted
        """
        error_trace = "".join(
            traceback.format_exception(
                type(exception), exception, exception.__traceback__
            )
        )

        return TestValidationResult(
            test_name=test_definition.name,
            test_type=test_definition.testDefinitionName,
            status=TestCaseStatus.Aborted,
            passed_rows=0,
            failed_rows=0,
            total_rows=0,
            failed_row_indices=None,
            result_message=f"Test execution failed: {str(exception)}\n{error_trace}",
            test_case_result=TestCaseResult(  # pyright: ignore[reportCallIssue]
                timestamp=int(time.time() * 1000),
                testCaseStatus=TestCaseStatus.Aborted,
                result=f"Test execution failed: {str(exception)}",
            ),
        )

    def _build_validation_result(
        self, test_results: List[TestValidationResult], execution_time_ms: float
    ) -> ValidationResult:
        """Build aggregated validation result.

        Args:
            test_results: Individual test results
            execution_time_ms: Total execution time

        Returns:
            ValidationResult with aggregated outcomes
        """
        passed = sum(1 for r in test_results if r.status == TestCaseStatus.Success)
        failed = len(test_results) - passed
        success = failed == 0

        return ValidationResult(
            success=success,
            total_tests=len(test_results),
            passed_tests=passed,
            failed_tests=failed,
            test_results=test_results,
            execution_time_ms=execution_time_ms,
        )
