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
import logging
import time
from datetime import datetime
from typing import List, Tuple, Type

from pandas import DataFrame

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.basic import Timestamp
from metadata.sdk.data_quality.dataframes.validation_results import (
    FailureMode,
    ValidationResult,
)
from metadata.sdk.data_quality.dataframes.validators import VALIDATOR_REGISTRY

logger = logging.getLogger(__name__)


class DataFrameValidationEngine:
    """Orchestrates execution of multiple validators on a DataFrame."""

    def __init__(self, test_cases: List[TestCase]):
        self.test_cases: List[TestCase] = test_cases

    def execute(
        self,
        df: DataFrame,
        mode: FailureMode = FailureMode.SHORT_CIRCUIT,
    ) -> ValidationResult:
        """Execute all validations and return aggregated results.

        Args:
            df: DataFrame to validate
            mode: Validation mode (only "short-circuit" supported)

        Returns:
            ValidationResult with outcomes for all tests
        """
        results: List[Tuple[TestCase, TestCaseResult]] = []
        start_time = time.time()

        for test_case in self.test_cases:
            test_result = self._execute_single_test(df, test_case)
            results.append((test_case, test_result))

            if mode is FailureMode.SHORT_CIRCUIT and test_result.testCaseStatus in (
                TestCaseStatus.Failed,
                TestCaseStatus.Aborted,
            ):
                break

        execution_time = (time.time() - start_time) * 1000
        return self._build_validation_result(results, execution_time)

    def _execute_single_test(
        self, df: DataFrame, test_case: TestCase
    ) -> TestCaseResult:
        """Execute validation and return structured result.

        Returns:
            TestValidationResult with validation outcome
        """
        validator_class = self._get_validator_class(test_case)

        validator = validator_class(
            runner=[df],
            test_case=test_case,
            execution_date=Timestamp(root=int(datetime.now().timestamp() * 1000)),
        )

        try:
            return validator.run_validation()
        except Exception as err:
            message = (
                f"Error executing {test_case.testDefinition.fullyQualifiedName} - {err}"
            )
            logger.exception(message)
            return validator.get_test_case_result_object(
                validator.execution_date,
                TestCaseStatus.Aborted,
                message,
                [],
            )

    @staticmethod
    def _build_validation_result(
        test_results: List[Tuple[TestCase, TestCaseResult]], execution_time_ms: float
    ) -> ValidationResult:
        """Build aggregated validation result.

        Args:
            test_results: Individual test results
            execution_time_ms: Total execution time

        Returns:
            ValidationResult with aggregated outcomes
        """
        passed = sum(
            1 for _, r in test_results if r.testCaseStatus == TestCaseStatus.Success
        )
        failed = len(test_results) - passed
        success = failed == 0

        return ValidationResult(
            success=success,
            total_tests=len(test_results),
            passed_tests=passed,
            failed_tests=failed,
            test_cases_and_results=test_results,
            execution_time_ms=execution_time_ms,
        )

    @staticmethod
    def _get_validator_class(test_case: TestCase) -> Type[BaseTestValidator]:
        """Resolve validator class from test definition name.

        Returns:
            Validator class for the test definition

        Raises:
            ValueError: If test definition is not supported
        """
        validator_class = VALIDATOR_REGISTRY.get(
            test_case.testDefinition.fullyQualifiedName  # pyright: ignore[reportArgumentType]
        )
        if not validator_class:
            raise ValueError(
                f"Unknown test definition: {test_case.testDefinition.fullyQualifiedName}"
            )

        return validator_class
