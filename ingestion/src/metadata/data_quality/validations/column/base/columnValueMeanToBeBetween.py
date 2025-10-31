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
Validator for column value mean to be between test case
"""

import traceback
from abc import abstractmethod
from typing import List, Optional, Union

from sqlalchemy import Column

from metadata.data_quality.validations.base_test_handler import (
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


class BaseColumnValueMeanToBeBetweenValidator(BaseTestValidator):
    """Validator for column value mean to be between test case"""

    MIN_BOUND = "minValueForMeanInCol"
    MAX_BOUND = "maxValueForMeanInCol"

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
            mean_value = self._run_results(Metrics.MEAN, column)

            metric_values = {
                Metrics.MEAN.name: mean_value,
            }

        except (ValueError, RuntimeError) as exc:
            msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name=Metrics.MEAN.name, value=None)],
            )

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
            test_params: Optional test parameters (unused for mean validator)

        Returns:
            dict: Dictionary mapping metric names to Metrics enum values
        """
        return {
            Metrics.MEAN.name: Metrics.MEAN,
        }

    def _evaluate_test_condition(
        self, metric_values: dict, test_params: dict
    ) -> TestEvaluation:
        """Evaluate the mean-to-be-between test condition

        For mean test, the condition passes if the mean value is within the specified bounds.
        Since this is a statistical validator (group-level), passed/failed row counts are not applicable.

        Args:
            metric_values: Dictionary with keys from Metrics enum names
                          e.g., {"MEAN": 42.5}
            test_params: Dictionary with 'minValueForMeanInCol' and 'maxValueForMeanInCol'

        Returns:
            dict with keys:
                - matched: bool - whether test passed (mean within bounds)
                - passed_rows: None - not applicable for statistical validators
                - failed_rows: None - not applicable for statistical validators
                - total_rows: None - not applicable for statistical validators
        """
        mean_value = metric_values[Metrics.MEAN.name]
        min_bound = test_params[self.MIN_BOUND]
        max_bound = test_params[self.MAX_BOUND]

        matched = min_bound <= mean_value <= max_bound

        return {
            "matched": matched,
            "passed_rows": None,
            "failed_rows": None,
            "total_rows": None,
        }

    def _format_result_message(
        self,
        metric_values: dict,
        dimension_info: Optional[DimensionInfo] = None,
        test_params: Optional[dict] = None,
    ) -> str:
        """Format the result message for mean-to-be-between test

        Args:
            metric_values: Dictionary with Metrics enum names as keys
            dimension_info: Optional DimensionInfo with dimension details
            test_params: Test parameters with min/max bounds. Required for this test.

        Returns:
            str: Formatted result message
        """
        if test_params is None:
            raise ValueError(
                "test_params is required for columnValueMeanToBeBetween._format_result_message"
            )

        mean_value = metric_values[Metrics.MEAN.name]
        min_bound = test_params[self.MIN_BOUND]
        max_bound = test_params[self.MAX_BOUND]

        if dimension_info:
            return (
                f"Dimension {dimension_info['dimension_name']}={dimension_info['dimension_value']}: "
                f"Found mean={mean_value} vs. the expected min={min_bound}, max={max_bound}"
            )
        else:
            return f"Found mean={mean_value} vs. the expected min={min_bound}, max={max_bound}."

    def _get_test_result_values(self, metric_values: dict) -> List[TestResultValue]:
        """Get test result values for mean-to-be-between test

        Args:
            metric_values: Dictionary with Metrics enum names as keys

        Returns:
            List[TestResultValue]: Test result values for the test case
        """
        return [
            TestResultValue(
                name=Metrics.MEAN.name,
                value=str(metric_values[Metrics.MEAN.name]),
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
