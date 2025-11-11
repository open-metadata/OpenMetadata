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
import traceback
from abc import ABC, abstractmethod
from typing import (
    TYPE_CHECKING,
    Callable,
    List,
    Optional,
    Type,
    TypedDict,
    TypeVar,
    Union,
)
from uuid import uuid4

from pydantic import BaseModel

from metadata.data_quality.validations import utils
from metadata.generated.schema.tests.basic import (
    DimensionValue,
    TestCaseDimensionResult,
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import Timestamp
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

if TYPE_CHECKING:
    from pandas import DataFrame
    from sqlalchemy import Column

logger = test_suite_logger()

T = TypeVar("T", bound=Callable)
R = TypeVar("R")
S = TypeVar("S", bound=BaseModel)

# Constants for dimensional validation
DIMENSION_OTHERS_LABEL = "Others"
DIMENSION_NULL_LABEL = "NULL"
DIMENSION_VALUE_KEY = "dimension_value"
DIMENSION_IMPACT_SCORE_KEY = "impact_score"
DIMENSION_FAILED_COUNT_KEY = "failed_count"
DIMENSION_TOTAL_COUNT_KEY = "total_count"
DIMENSION_SUM_VALUE_KEY = (
    "sum_value"  # For statistical validators weighted calculations
)


class TestEvaluation(TypedDict, total=False):
    """Result of evaluating a test condition

    Attributes:
        matched: Whether the test passed
        passed_rows: Number of rows that passed the test
        failed_rows: Number of rows that failed the test
        total_rows: Total number of rows (optional, test-specific)
    """

    matched: bool
    passed_rows: Optional[int]
    failed_rows: Optional[int]
    total_rows: Optional[int]


class DimensionInfo(TypedDict):
    """Information about a dimension for result formatting

    Attributes:
        dimension_name: Name of the dimension column
        dimension_value: Value of this dimension group
    """

    dimension_name: str
    dimension_value: str


class BaseTestValidator(ABC):
    """Abstract class for test case handlers
    The runtime_parameter_setter is run after the test case is created to set the runtime parameters.
    This can be useful to resolve complex test parameters based on the parameters given by the user.
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
            logger.debug(
                f"Executing dimensional validation for test case: {self.test_case.fullyQualifiedName}"
            )
            logger.debug(f"Dimension columns: {self.test_case.dimensionColumns}")

            # Validate dimension columns exist in the target table
            if not self.are_dimension_columns_valid():
                # Don't abort the main test, just skip dimensional validation
                # The main test result is still valid
                return test_result

            try:
                dimension_results = self._run_dimensional_validation()
                if dimension_results:
                    logger.debug(
                        f"Dimensional validation completed with {len(dimension_results)} results"
                    )

                    test_case_dimension_results = (
                        self._convert_to_test_case_dimension_results(
                            dimension_results, test_result
                        )
                    )

                    test_result.dimensionResults = test_case_dimension_results
                    logger.debug(
                        f"Attached {len(test_case_dimension_results)} dimension results to main test result"
                    )
                else:
                    logger.debug("Dimensional validation completed with no results")

            except Exception as exc:
                logger.warning(
                    f"Dimensional validation failed for {self.test_case.fullyQualifiedName}: {exc}"
                )
                logger.debug(traceback.format_exc())

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

    def _run_dimensional_validation(self) -> List[DimensionResult]:
        """Execute dimensional validation for this test

        Default implementation that delegates to _execute_dimensional_validation
        for each dimension column. This provides a common pattern across validators.

        The new approach runs separate queries for each dimension column instead of
        combining them with GROUP BY. For example, if dimensionColumns = ["country", "age"],
        this method will:
        1. Run one query: GROUP BY country -> {"Spain": result1, "Argentina": result2}
        2. Run another query: GROUP BY age -> {"10": result3, "12": result4}

        Override this method only if you need completely different dimensional logic.
        Most validators should just implement _execute_dimensional_validation instead.

        Returns:
            List[DimensionResult]: List of dimension-specific test results
        """
        try:
            dimension_columns = self.test_case.dimensionColumns or []
            if not dimension_columns:
                return []

            column: Union[SQALikeColumn, Column] = self.get_column()

            test_params = self._get_test_parameters()
            metrics_to_compute = self._get_metrics_to_compute(test_params)

            dimension_results = []
            for dimension_column in dimension_columns:
                try:
                    dimension_col = self.get_column(dimension_column)

                    single_dimension_results = self._execute_dimensional_validation(
                        column, dimension_col, metrics_to_compute, test_params
                    )

                    dimension_results.extend(single_dimension_results)

                except Exception as exc:
                    logger.warning(
                        f"Error executing dimensional query for column {dimension_column}: {exc}"
                    )
                    logger.debug(traceback.format_exc())
                    continue

            return dimension_results

        except Exception as exc:
            logger.warning(f"Error executing dimensional validation: {exc}")
            logger.debug(traceback.format_exc())
            return []

    def _get_test_parameters(self) -> dict:
        """Get test-specific parameters from test case

        Default implementation returns empty dict. Override in child classes
        that need to extract and process test parameters.

        Returns:
            dict: Test parameters, or empty dict if validator has no parameters.
        """
        return {}

    def _get_metrics_to_compute(self, test_params: Optional[dict] = None) -> dict:
        """Get metrics that need to be computed for this test

        Default implementation returns empty dict. Override in child classes
        that implement dimensional validation.

        Args:
            test_params: Optional test parameters (may affect which metrics to compute)

        Returns:
            dict: Dictionary mapping metric names to Metrics enum values
                  e.g., {"MIN": Metrics.MIN} or {"COUNT": Metrics.COUNT, "UNIQUE_COUNT": Metrics.UNIQUE_COUNT}
        """
        return {}

    def get_column(
        self, column_name: Optional[str] = None
    ) -> Union[SQALikeColumn, Column]:
        """Get column object from column_name. If no column_name is present,
        it returns the main column for the test.

        Uses cooperative multiple inheritance. Implementation provided by
        SQAValidatorMixin or PandasValidatorMixin via MRO chain.
        Concrete validators must inherit from one of these mixins.

        Returns:
            Column object (sqlalchemy.Column or SQALikeColumn depending on mixin)
        """
        return super().get_column(column_name)  # type: ignore

    def _execute_dimensional_validation(
        self,
        column: Union[SQALikeColumn, Column],
        dimension_col: Union[SQALikeColumn, Column],
        metrics_to_compute: dict,
        test_params: Optional[dict],
    ) -> List[DimensionResult]:
        """Execute dimensional validation query for a single dimension column

        Must be implemented by child classes to support dimensional validation.

        Args:
            column: The column being tested (e.g., revenue)
            dimension_col: The dimension column to group by (e.g., region)
            metrics_to_compute: Dict mapping metric names to Metrics enum values
            test_params: Test parameters including bounds, allowed values, etc.

        Returns:
            List[DimensionResult]: List of dimension results for each dimension value

        Raises:
            NotImplementedError: If child class doesn't override this method
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} must implement _execute_dimensional_validation() for dimensional validation"
        )

    def _evaluate_test_condition(
        self, metric_values: dict, test_params: Optional[dict] = None
    ) -> TestEvaluation:
        """Evaluate the test condition based on computed metrics

        This is the core logic that determines if the test passes or fails.
        Override in child classes to implement test-specific evaluation logic.

        Default implementation raises NotImplementedError. Validators that have been
        migrated to the new pattern should override this method.

        Args:
            metric_values: Dictionary with Metrics enum names as keys
                          e.g., {"COUNT": 100, "MEAN": 42.5}
            test_params: Optional test parameters (bounds, allowed values, etc.)
                        Some validators don't need parameters (e.g., uniqueness test)

        Returns:
            TestEvaluation: TypedDict with keys:
                - matched: bool - whether test passed
                - passed_rows: Optional[int] - number of passing rows (None for statistical tests)
                - failed_rows: Optional[int] - number of failing rows (None for statistical tests)
                - total_rows: Optional[int] - total row count (None for statistical tests)

        Raises:
            NotImplementedError: If child class doesn't override this method
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} must implement _evaluate_test_condition()"
        )

    def _format_result_message(
        self,
        metric_values: dict,
        dimension_info: Optional[DimensionInfo] = None,
        test_params: Optional[dict] = None,
    ) -> str:
        """Format the result message for the test

        Override in child classes to provide human-readable test results.

        Default implementation raises NotImplementedError. Validators that have been
        migrated to the new pattern should override this method.

        Args:
            metric_values: Dictionary with Metrics enum names as keys
            dimension_info: Optional dimension details for dimensional results
            test_params: Optional test parameters (for displaying bounds, thresholds, etc.)

        Returns:
            str: Formatted result message

        Raises:
            NotImplementedError: If child class doesn't override this method
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} must implement _format_result_message()"
        )

    def _extract_dimension_value(self, row: dict) -> str:
        """Extract and format dimension value from result row

        Args:
            row: Result row from dimensional query

        Returns:
            str: Formatted dimension value (NULL label if value is None)
        """
        return (
            str(row[DIMENSION_VALUE_KEY])
            if row[DIMENSION_VALUE_KEY] is not None
            else DIMENSION_NULL_LABEL
        )

    def _build_metric_values_from_row(
        self,
        row: dict,
        metrics_to_compute: dict,
        test_params: Optional[dict] = None,
    ) -> dict:
        """Build metric_values dictionary from result row

        Args:
            row: Result row from dimensional query
            metrics_to_compute: Metrics that were computed (keys are enum names)
            test_params: Optional test parameters for conditional metric inclusion

        Returns:
            dict: Metric values with enum names as keys, defaulting to 0 for missing values
        """
        return {
            metric_name: row.get(metric_name, 0) or 0
            for metric_name in metrics_to_compute.keys()
        }

    def _create_dimension_result(
        self,
        row: dict,
        dimension_col_name: str,
        metric_values: dict,
        evaluation: TestEvaluation,
        test_params: Optional[dict] = None,
    ) -> DimensionResult:
        """Create a DimensionResult from a result row

        This method encapsulates the common pattern of creating dimensional results:
        1. Extract dimension value
        2. Format result message
        3. Get test result values
        4. Create DimensionResult object

        Args:
            row: Result row from dimensional query
            dimension_col_name: Name of the dimension column
            metric_values: Computed metric values
            evaluation: Test evaluation result from _evaluate_test_condition
            test_params: Optional test parameters

        Returns:
            DimensionResult: Formatted dimension result
        """
        dimension_value = self._extract_dimension_value(row)

        result_message = self._format_result_message(
            metric_values,
            dimension_info=DimensionInfo(
                dimension_name=dimension_col_name,
                dimension_value=dimension_value,
            ),
            test_params=test_params,
        )

        test_result_values = self._get_test_result_values(metric_values)
        impact_score = row.get(DIMENSION_IMPACT_SCORE_KEY, 0.0)

        return self.get_dimension_result_object(
            dimension_values={dimension_col_name: dimension_value},
            test_case_status=self.get_test_case_status(evaluation["matched"]),
            result=result_message,
            test_result_value=test_result_values,
            total_rows=evaluation["total_rows"],
            passed_rows=evaluation["passed_rows"],
            failed_rows=evaluation["failed_rows"],
            impact_score=impact_score,
        )

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

    def _convert_to_test_case_dimension_results(
        self,
        dimension_results: List[DimensionResult],
        test_result: TestCaseResult,
    ) -> List[TestCaseDimensionResult]:
        """Convert DimensionResult objects to TestCaseDimensionResult objects"""
        test_case_dimension_results = []

        for dim_result in dimension_results:
            dimension_key = ",".join(
                [
                    f"{dim_val.name}={dim_val.value}"
                    for dim_val in dim_result.dimensionValues
                ]
            )

            test_case_dim_result = TestCaseDimensionResult(
                id=str(uuid4()),
                testCaseResultId=test_result.id or str(uuid4()),
                testCase=None,  # Backend will populate EntityReference during retrieval using testCaseFQN
                timestamp=test_result.timestamp,
                dimensionValues=dim_result.dimensionValues,
                dimensionKey=dimension_key,
                testCaseStatus=dim_result.testCaseStatus,
                result=dim_result.result,
                testResultValue=dim_result.testResultValue,
                passedRows=dim_result.passedRows,
                failedRows=dim_result.failedRows,
                passedRowsPercentage=dim_result.passedRowsPercentage,
                failedRowsPercentage=dim_result.failedRowsPercentage,
                impactScore=dim_result.impactScore,  # Include the impact score
            )

            test_case_dimension_results.append(test_case_dim_result)

        return test_case_dimension_results

    def are_dimension_columns_valid(self) -> bool:
        """Validate that all dimension columns exist in the target table

        Returns:
            bool: True if all dimension columns are valid, False otherwise
        """
        if not self.is_dimensional_test():
            return False  # No dimensions to validate

        if not hasattr(self, "get_column"):
            logger.warning("Validator does not support dimensional column validation")
            return False

        try:
            missing_columns = []
            for dim_col in self.test_case.dimensionColumns:
                try:
                    self.get_column(dim_col)  # type: ignore[attr-defined] - Delegates to child class
                except ValueError:
                    missing_columns.append(dim_col)
                except NotImplementedError:
                    # Child class doesn't support dimensional validation yet
                    logger.warning(
                        "Validator does not support dimensional column validation"
                    )
                    return False

            if missing_columns:
                logger.warning(
                    f"Dimensional validation skipped: Dimension columns not found in table: {', '.join(missing_columns)}"
                )
                return False

            return True

        except Exception as exc:
            logger.warning(f"Unable to validate dimension columns: {exc}")
            return False

    def get_dimension_result_object(
        self,
        dimension_values: dict,
        test_case_status: TestCaseStatus,
        result: str,
        test_result_value: List[TestResultValue],
        total_rows: Optional[int] = None,
        passed_rows: Optional[int] = None,
        failed_rows: Optional[int] = None,
        impact_score: Optional[float] = None,
    ) -> "DimensionResult":
        """Returns a DimensionResult object with automatic percentage calculations

        Args:
            dimension_values: Dictionary mapping dimension column names to their values
            test_case_status: Status of the test for this dimension combination
            result: Details of test case results for this dimension combination
            test_result_value: List of test result values
            total_rows: Total number of rows in this dimension (None for statistical validators)
            passed_rows: Number of rows that passed for this dimension (None for statistical validators)
            failed_rows: Number of rows that failed for this dimension (auto-calculated if None, None for statistical validators)
            impact_score: Optional impact score for this dimension (0-1 range)

        Returns:
            DimensionResult: Dimension result object with calculated percentages
        """
        # Handle row counts and percentages for statistical validators
        if total_rows is None or passed_rows is None:
            passed_rows_percentage = None
            failed_rows_percentage = None
        else:
            # Row-by-row validators: calculate percentages
            if failed_rows is None:
                failed_rows = total_rows - passed_rows

            # Derive one percentage from the other to ensure they sum to 100%
            if total_rows > 0:
                passed_rows_percentage = round(passed_rows / total_rows * 100, 2)
                failed_rows_percentage = round(100 - passed_rows_percentage, 2)
            else:
                passed_rows_percentage = 0
                failed_rows_percentage = 0

        dimension_values_array = [
            DimensionValue(name=name, value=value)
            for name, value in dimension_values.items()
        ]

        dimension_result = DimensionResult(
            dimensionValues=dimension_values_array,
            testCaseStatus=test_case_status,
            result=result,
            testResultValue=test_result_value,
            passedRows=passed_rows,
            failedRows=failed_rows,
            passedRowsPercentage=passed_rows_percentage,
            failedRowsPercentage=failed_rows_percentage,
            impactScore=round(impact_score, 4) if impact_score is not None else None,
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
