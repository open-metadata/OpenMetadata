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
Validator for column values to be unique test case
"""

import traceback
from abc import abstractmethod
from typing import List, Optional, Union

from sqlalchemy import Column

from metadata.data_quality.validations.base_test_handler import (
    BaseTestValidator,
    DimensionInfo,
    TestEvaluation,
)
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = test_suite_logger()

VALUE_COUNT = "valueCount"
UNIQUE_COUNT = "uniqueCount"


class BaseColumnValuesToBeUniqueValidator(BaseTestValidator):
    """Validator for column values to be unique test case"""

    def _get_metrics_to_compute(self, test_params: Optional[dict] = None) -> dict:
        """Define which metrics to compute for uniqueness test

        Args:
            test_params: Optional test parameters (unused for uniqueness test)

        Returns:
            dict: Mapping of Metrics enum names to Metrics enum values
                  e.g., {"COUNT": Metrics.COUNT, "UNIQUE_COUNT": Metrics.UNIQUE_COUNT}
        """
        return {
            Metrics.COUNT.name: Metrics.COUNT,
            Metrics.UNIQUE_COUNT.name: Metrics.UNIQUE_COUNT,
        }

    def _evaluate_test_condition(
        self, metric_values: dict, test_params: Optional[dict] = None
    ) -> TestEvaluation:
        """Evaluate the uniqueness test condition and calculate derived values

        For uniqueness test: all values should be unique, meaning COUNT == UNIQUE_COUNT

        Args:
            metric_values: Dictionary with keys from Metrics enum names
                          e.g., {"COUNT": 100, "UNIQUE_COUNT": 95}
            test_params: Optional test parameters (not used by uniqueness validator)

        Returns:
            TestEvaluation: TypedDict with keys:
                - matched: bool - whether test passed (count == unique_count)
                - passed_rows: int - number of unique values
                - failed_rows: int - number of duplicate values
                - total_rows: int - total row count
        """
        count = metric_values[Metrics.COUNT.name]
        unique_count = metric_values[Metrics.UNIQUE_COUNT.name]

        return {
            "matched": count == unique_count,
            "passed_rows": unique_count,
            "failed_rows": count - unique_count,
            "total_rows": count,
        }

    def _format_result_message(
        self,
        metric_values: dict,
        dimension_info: Optional[DimensionInfo] = None,
        test_params: Optional[dict] = None,
    ) -> str:
        """Format the result message for uniqueness test

        Args:
            metric_values: Dictionary with Metrics enum names as keys
            dimension_info: Optional DimensionInfo with dimension details
            test_params: Optional test parameters (not used by this validator)

        Returns:
            str: Formatted result message
        """
        count = metric_values[Metrics.COUNT.name]
        unique_count = metric_values[Metrics.UNIQUE_COUNT.name]

        if dimension_info:
            return (
                f"Dimension {dimension_info['dimension_name']}={dimension_info['dimension_value']}: "
                f"Found valuesCount={count} vs. uniqueCount={unique_count}"
            )
        else:
            return (
                f"Found valuesCount={count} vs. uniqueCount={unique_count}. "
                "Both counts should be equal for column values to be unique."
            )

    def _get_test_result_values(self, metric_values: dict) -> List[TestResultValue]:
        """Get test result values for uniqueness test

        Args:
            metric_values: Dictionary with Metrics enum names as keys

        Returns:
            List[TestResultValue]: Test result values for the test case
        """
        return [
            TestResultValue(
                name=VALUE_COUNT, value=str(metric_values[Metrics.COUNT.name])
            ),
            TestResultValue(
                name=UNIQUE_COUNT, value=str(metric_values[Metrics.UNIQUE_COUNT.name])
            ),
        ]

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
            count = self._run_results(Metrics.COUNT, column)
            unique_count = self._get_unique_count(Metrics.UNIQUE_COUNT, column)

            metric_values = {
                Metrics.COUNT.name: count,
                Metrics.UNIQUE_COUNT.name: unique_count,
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
                    TestResultValue(name=VALUE_COUNT, value=None),
                    TestResultValue(name=UNIQUE_COUNT, value=None),
                ],
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
            row_count=count,
            passed_rows=evaluation["passed_rows"],
        )

    @abstractmethod
    def _run_results(self, metric: Metrics, column: Union[SQALikeColumn, Column]):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for

        Raises:
            NotImplementedError:
        """
        raise NotImplementedError

    @abstractmethod
    def _get_unique_count(self, metric: Metrics, column: Union[SQALikeColumn, Column]):
        """Get row count

        Returns:
            Tuple[int, int]:
        """
        raise NotImplementedError

    @abstractmethod
    def _execute_dimensional_validation(
        self,
        column: Union[SQALikeColumn, Column],
        dimension_col: Union[SQALikeColumn, Column],
        metrics_to_compute: dict,
        test_params: Optional[dict] = None,
    ) -> List[DimensionResult]:
        """Execute dimensional query for a single dimension

        This method should implement the engine-specific logic for executing
        dimensional queries for a single dimension column using GROUP BY.

        The method executes a single GROUP BY query for one dimension column,
        returning results for each distinct value of that dimension.

        For the uniqueness test, metrics_to_compute will be:
        {"COUNT": Metrics.COUNT, "UNIQUE_COUNT": Metrics.UNIQUE_COUNT}

        For other tests, it could be:
        {"MIN": Metrics.MIN, "MAX": Metrics.MAX}
        {"COUNT_IN_SET": Metrics.COUNT_IN_SET}
        {"NULL_MISSING_COUNT": Metrics.NULL_MISSING_COUNT}

        Args:
            column: The column being validated (same as used in _run_validation)
            dimension_col: Single Column object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping Metrics enum names to Metrics objects
            test_params: Optional test parameters (empty dict for uniqueness validator)

        Returns:
            List[DimensionResult]: List of dimension results for this dimension column
            Example: [DimensionResult(dimensionValues={"country": "Spain"}, ...), DimensionResult(dimensionValues={"country": "Argentina"}, ...)]
        """
        raise NotImplementedError
