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

"""
Base validator class
"""

from __future__ import annotations

import reprlib
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Callable, List, Optional, Type, TypeVar, Union

from pydantic import BaseModel

from metadata.data_quality.validations import utils
from metadata.generated.schema.tests.basic import (
    DimensionResult,
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import Timestamp
from metadata.profiler.processor.runner import QueryRunner

if TYPE_CHECKING:
    from pandas import DataFrame

    # Import DimensionResult for type checking
    from metadata.generated.schema.tests.basic import DimensionResult

T = TypeVar("T", bound=Callable)
R = TypeVar("R")
S = TypeVar("S", bound=BaseModel)


class BaseTestValidator(ABC):
    """Abstract class for test case handlers
    The runtime_parameter_setter is run after the test case is created to set the runtime parameters.
    This can be useful to resolve complex test parameters based on the parameters gibven by the user.
    """

    def __init__(
        self,
        runner: Union[QueryRunner, List["DataFrame"]],
        test_case: TestCase,
        execution_date: Timestamp,
    ) -> None:
        self.runner = runner
        self.test_case = test_case
        self.execution_date = execution_date

    def is_dimensional_test(self) -> bool:
        """Check if test case has dimension columns configured for dimensional analysis

        Returns:
            bool: True if this test should be executed with dimensional grouping
        """
        return (
            hasattr(self.test_case, "dimensionColumns")
            and self.test_case.dimensionColumns is not None
            and len(self.test_case.dimensionColumns) > 0
        )

    def run_validation(self) -> TestCaseResult:
        """Template method defining the validation flow with optional dimensional analysis

        This method orchestrates the overall validation process:
        1. Execute the main validation logic (overall results)
        2. Add dimensional results if configured

        Child classes can override this method to provide custom validation logic.
        If not overridden, this template method provides the default dimensional behavior.

        Returns:
            TestCaseResult: The test case result with optional dimensional results
        """
        # Execute the main validation logic (overall results)
        test_result = self._run_validation()

        # Add dimensional results if configured
        if self.is_dimensional_test():
            try:
                dimension_results = self._run_dimensional_validation()
                test_result.dimensionResults = dimension_results
            except NotImplementedError:
                # Fallback: dimensional validation not implemented yet
                # This allows gradual migration of validators
                pass

        return test_result

    @abstractmethod
    def _run_validation(self) -> TestCaseResult:
        """Execute the specific test validation logic

        This method should contain the core validation logic that was previously
        in the run_validation method of child classes.

        Returns:
            TestCaseResult: The test case result for the overall validation
        """
        raise NotImplementedError

    @abstractmethod
    def _run_dimensional_validation(self) -> List["DimensionResult"]:
        """Execute dimensional validation for this test

        This method should implement the dimensional logic specific to each test type.
        It will be called automatically by the template method when dimensionColumns
        are configured in the test case.

        Returns:
            List[DimensionResult]: List of dimension-specific test results
        """
        raise NotImplementedError

    @staticmethod
    def get_test_case_param_value(
        test_case_param_vals: List[TestCaseParameterValue],
        name: str,
        type_: T,
        default: Optional[R] = None,
        pre_processor: Optional[Callable] = None,
    ) -> Optional[Union[R, T]]:
        return utils.get_test_case_param_value(
            test_case_param_vals, name, type_, default, pre_processor
        )

    def get_test_case_result_object(  # pylint: disable=too-many-arguments
        self,
        execution_date: Timestamp,
        status: TestCaseStatus,
        result: str,
        test_result_value: List[TestResultValue],
        row_count: Optional[int] = None,
        failed_rows: Optional[int] = None,
        passed_rows: Optional[int] = None,
        min_bound: Optional[float] = None,
        max_bound: Optional[float] = None,
    ) -> TestCaseResult:
        """Returns a TestCaseResult object with the given args

        Args:
            execution_date (Union[datetime, float]): test case execution datetime
            status (TestCaseStatus): failed, success, aborted
            result (str): test case result
            test_result_value (List[TestResultValue]): test result value to display in UI
        Returns:
            TestCaseResult:
        """
        test_case_result = TestCaseResult(
            timestamp=execution_date,  # type: ignore
            testCaseStatus=status,
            result=result,
            testResultValue=test_result_value,
            sampleData=None,
            # if users don't set the min/max bound, we'll change the inf/-inf (used for computation) to None
            minBound=None if min_bound == float("-inf") else min_bound,
            maxBound=None if max_bound == float("inf") else max_bound,
        )

        if (row_count is not None and row_count != 0) and (
            # we'll need at least one of these to be not None to compute the other
            (failed_rows is not None)
            or (passed_rows is not None)
        ):
            passed_rows = passed_rows if passed_rows is not None else (row_count - failed_rows)  # type: ignore
            failed_rows = (
                failed_rows if failed_rows is not None else (row_count - passed_rows)
            )
            test_case_result.passedRows = int(passed_rows)
            test_case_result.failedRows = int(failed_rows)
            test_case_result.passedRowsPercentage = float(passed_rows / row_count) * 100
            test_case_result.failedRowsPercentage = float(failed_rows / row_count) * 100  # type: ignore

        return test_case_result

    def get_dimension_result_object(
        self,
        dimension_values: dict,
        test_case_status: TestCaseStatus,
        result: str,
        test_result_value: List[TestResultValue],
        total_rows: int,
        passed_rows: int,
        failed_rows: Optional[int] = None,
    ) -> "DimensionResult":
        """Returns a DimensionResult object with automatic percentage calculations

        Args:
            dimension_values: Dictionary mapping dimension column names to their values
            test_case_status: Status of the test for this dimension combination
            result: Details of test case results for this dimension combination
            test_result_value: List of test result values
            total_rows: Total number of rows in this dimension
            passed_rows: Number of rows that passed for this dimension
            failed_rows: Number of rows that failed for this dimension (auto-calculated if None)

        Returns:
            DimensionResult: Dimension result object with calculated percentages
        """
        # Auto-calculate failed rows if not provided
        if failed_rows is None:
            failed_rows = total_rows - passed_rows

        # Calculate percentages
        passed_rows_percentage = (
            (passed_rows / total_rows * 100) if total_rows > 0 else 0
        )
        failed_rows_percentage = (
            (failed_rows / total_rows * 100) if total_rows > 0 else 0
        )

        dimension_result = DimensionResult(
            dimensionValues=dimension_values,
            testCaseStatus=test_case_status,
            result=result,
            testResultValue=test_result_value,
            passedRows=passed_rows,
            failedRows=failed_rows,
            passedRowsPercentage=passed_rows_percentage,
            failedRowsPercentage=failed_rows_percentage,
        )

        return dimension_result

    def format_column_list(self, status: TestCaseStatus, cols: List):
        """Format column list based on the test status

        Args:
            cols: list of columns
        """
        if status == TestCaseStatus.Success:
            return reprlib.repr(cols)
        return cols

    def get_test_case_status(self, condition: bool) -> TestCaseStatus:
        """Returns TestCaseStatus based on condition

        Args:
            condition (bool): condition to check
        Returns:
            TestCaseStatus:
        """
        return TestCaseStatus.Success if condition else TestCaseStatus.Failed

    def get_min_bound(self, param_name: str) -> Optional[float]:
        """get min value for max value in column test case"""
        return self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            param_name,
            float,
            default=float("-inf"),
        )

    def get_max_bound(self, param_name: str) -> Optional[float]:
        """get max value for max value in column test case"""
        return self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            param_name,
            float,
            default=float("inf"),
        )

    def get_predicted_value(self) -> Optional[str]:
        """Get predicted value"""
        return None

    def get_runtime_parameters(self, setter_class: Type[S]) -> S:
        """Get runtime parameters"""
        for param in self.test_case.parameterValues or []:
            if param.name == setter_class.__name__:
                return setter_class.model_validate_json(param.value)
        raise ValueError(f"Runtime parameter {setter_class.__name__} not found")
