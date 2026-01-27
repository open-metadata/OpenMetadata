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
Validator for column value length to be between test case
"""

import traceback
from abc import abstractmethod
from typing import List, Optional, Tuple, Union

from sqlalchemy import Column

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
    BaseTestValidator,
    DimensionInfo,
    DimensionResult,
    TestEvaluation,
)
from metadata.data_quality.validations.checkers.between_bounds_checker import (
    BetweenBoundsChecker,
)
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = test_suite_logger()

MIN_LENGTH_METRIC_NAME = "minValueLength"
MAX_LENGTH_METRIC_NAME = "maxValueLength"


class BaseColumnValueLengthsToBeBetweenValidator(BaseTestValidator):
    """Validator for column value length to be between test case"""

    MIN_BOUND = "minLength"
    MAX_BOUND = "maxLength"

    def _run_validation(self) -> TestCaseResult:
        """Execute the specific test validation logic

        This method contains the core validation logic that was previously
        in the run_validation method.

        Returns:
            TestCaseResult: The test case result for the overall validation
        """
        test_params = self._get_test_parameters()

        try:
            column: Union[SQALikeColumn, Column] = self.get_column()
            max_res = self._run_results(Metrics.MAX_LENGTH, column)
            min_res = self._run_results(Metrics.MIN_LENGTH, column)

            metric_values = {
                Metrics.MAX_LENGTH.name: max_res,
                Metrics.MIN_LENGTH.name: min_res,
            }

        except (ValueError, RuntimeError) as exc:
            msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [
                    TestResultValue(name=MIN_LENGTH_METRIC_NAME, value=None),
                    TestResultValue(name=MAX_LENGTH_METRIC_NAME, value=None),
                ],
            )

        if self.test_case.computePassedFailedRowCount:
            row_count, failed_rows = self.compute_row_count(
                column, test_params[self.MIN_BOUND], test_params[self.MAX_BOUND]
            )
        else:
            row_count, failed_rows = None, None

        evaluation = self._evaluate_test_condition(metric_values, test_params)
        result_message = self._format_result_message(
            metric_values, test_params=test_params
        )
        test_result_values = self._get_test_result_values(metric_values)

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(evaluation["matched"]),
            result_message,
            test_result_values,
            row_count=row_count,
            failed_rows=failed_rows,
            min_bound=test_params[self.MIN_BOUND],
            max_bound=test_params[self.MAX_BOUND],
        )

    def _get_validation_checker(self, test_params: dict) -> BetweenBoundsChecker:
        return BetweenBoundsChecker(
            min_bound=test_params[self.MIN_BOUND],
            max_bound=test_params[self.MAX_BOUND],
        )

    def _get_test_parameters(self) -> dict:
        """Get test parameters for this validator

        Returns:
            dict: Test parameters including min and max bounds
        """
        return {
            self.MIN_BOUND: self.get_min_bound(self.MIN_BOUND),
            self.MAX_BOUND: self.get_max_bound(self.MAX_BOUND),
        }

    def _get_metrics_to_compute(self, test_params: Optional[dict] = None) -> dict:
        """Get metrics that need to be computed for this test

        Args:
            test_params: Optional test parameters (unused for max validator)

        Returns:
            dict: Dictionary mapping metric names to Metrics enum values
        """
        return {
            Metrics.MAX_LENGTH.name: Metrics.MAX_LENGTH,
            Metrics.MIN_LENGTH.name: Metrics.MIN_LENGTH,
        }

    def _evaluate_test_condition(
        self, metric_values: dict, test_params: dict
    ) -> TestEvaluation:
        """Evaluate the max-to-be-between test condition

        For dimensional validation, computes row-level passed/failed counts.
        For non-dimensional validation, row counts are not applicable.

        Args:
            metric_values: Dictionary with keys from Metrics enum names
                          e.g., {"MAX_LENGTH": 10, "MIN_LENGTH": 1}
                          For dimensional validation, also includes:
                          - DIMENSION_TOTAL_COUNT_KEY: total rows
                          - DIMENSION_FAILED_COUNT_KEY: failed rows
            test_params: Dictionary with 'minLength' and 'maxLength'

        Returns:
            dict with keys:
                - matched: bool - whether test passed (lengths within bounds)
                - passed_rows: Optional[int] - rows with valid lengths (or None for non-dimensional)
                - failed_rows: Optional[int] - rows with invalid lengths (or None for non-dimensional)
                - total_rows: Optional[int] - total rows (or None for non-dimensional)
        """
        min_length_value = metric_values[Metrics.MIN_LENGTH.name]
        max_length_value = metric_values[Metrics.MAX_LENGTH.name]
        min_bound = test_params[self.MIN_BOUND]
        max_bound = test_params[self.MAX_BOUND]

        matched = min_bound <= min_length_value and max_length_value <= max_bound

        # Extract row counts if available (dimensional validation)
        total_rows = metric_values.get(DIMENSION_TOTAL_COUNT_KEY)
        failed_rows = metric_values.get(DIMENSION_FAILED_COUNT_KEY)
        passed_rows = None
        if total_rows is not None and failed_rows is not None:
            passed_rows = total_rows - failed_rows

        return {
            "matched": matched,
            "passed_rows": passed_rows,
            "failed_rows": failed_rows,
            "total_rows": total_rows,
        }

    def _format_result_message(
        self,
        metric_values: dict,
        dimension_info: Optional[DimensionInfo] = None,
        test_params: Optional[dict] = None,
    ) -> str:
        """Format the result message for max-to-be-between test

        Args:
            metric_values: Dictionary with Metrics enum names as keys
            dimension_info: Optional DimensionInfo with dimension details
            test_params: Test parameters with min/max bounds. Required for this test.

        Returns:
            str: Formatted result message
        """
        if test_params is None:
            raise ValueError(
                "test_params is required for columnValueLengthToBeBetween._format_result_message"
            )

        min_length_value = metric_values[Metrics.MIN_LENGTH.name]
        max_length_value = metric_values[Metrics.MAX_LENGTH.name]
        min_bound = test_params[self.MIN_BOUND]
        max_bound = test_params[self.MAX_BOUND]

        if dimension_info:
            return (
                f"Dimension {dimension_info['dimension_name']}={dimension_info['dimension_value']}: "
                f"Found minLength={min_length_value}, maxLength={max_length_value} vs. the expected minLength={min_bound}, maxLength={max_bound}"
            )
        else:
            return f"Found minLength={min_length_value}, maxLength={max_length_value} vs. the expected minLength={min_bound}, maxLength={max_bound}."

    def _get_test_result_values(self, metric_values: dict) -> List[TestResultValue]:
        """Get test result values for max-to-be-between test

        Args:
            metric_values: Dictionary with Metrics enum names as keys

        Returns:
            List[TestResultValue]: Test result values for the test case
        """
        return [
            TestResultValue(
                name=MIN_LENGTH_METRIC_NAME,
                value=str(metric_values[Metrics.MIN_LENGTH.name]),
            ),
            TestResultValue(
                name=MAX_LENGTH_METRIC_NAME,
                value=str(metric_values[Metrics.MAX_LENGTH.name]),
            ),
        ]

    @abstractmethod
    def _run_results(self, metric: Metrics, column: Union[SQALikeColumn, Column]):
        raise NotImplementedError

    @abstractmethod
    def _execute_dimensional_validation(
        self,
        column: Union[SQALikeColumn, Column],
        dimension_col: Union[SQALikeColumn, Column],
        metrics_to_compute: dict,
        test_params: dict,
    ) -> List[DimensionResult]:
        """Execute dimensional validation query for a single dimension column

        Args:
            column: The column being tested (e.g., revenue)
            dimension_col: The dimension column to group by (e.g., region)
            metrics_to_compute: Dict mapping metric names to Metrics enum values
            test_params: Test parameters including min and max bounds

        Returns:
            List of DimensionResult objects for each dimension value
        """
        raise NotImplementedError

    @abstractmethod
    def compute_row_count(
        self, column: Union[SQALikeColumn, Column], min_bound, max_bound
    ):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for
            min_bound (_type_): min bound to filter out rows within the bound
            max_bound (_type_): max bound to filter out rows within the bound

        Raises:
            NotImplementedError:
        """
        raise NotImplementedError

    def get_row_count(self, min_bound, max_bound) -> Tuple[int, int]:
        """Get row count

        Args:
            min_bound (_type_): min bound to filter out rows within the bound
            max_bound (_type_): max bound to filter out rows within the bound

        Returns:
            Tuple[int, int]:
        """
        return self.compute_row_count(self.get_column(), min_bound, max_bound)
