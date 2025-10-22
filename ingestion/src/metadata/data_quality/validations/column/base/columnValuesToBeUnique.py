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
    ) -> dict:
        """Evaluate the uniqueness test condition and calculate derived values

        For uniqueness test: all values should be unique, meaning COUNT == UNIQUE_COUNT

        Args:
            metric_values: Dictionary with keys from Metrics enum names
                          e.g., {"COUNT": 100, "UNIQUE_COUNT": 95}

        Returns:
            dict with keys:
                - matched: bool - whether test passed (count == unique_count)
                - passed_rows: int - number of unique values
                - failed_rows: int - number of duplicate values
        """
        count = metric_values[Metrics.COUNT.name]
        unique_count = metric_values[Metrics.UNIQUE_COUNT.name]

        return {
            "matched": count == unique_count,
            "passed_rows": unique_count,
            "failed_rows": count - unique_count,
        }

    def _format_result_message(
        self, metric_values: dict, dimension_info: Optional[DimensionInfo] = None
    ) -> str:
        """Format the result message for uniqueness test

        Args:
            metric_values: Dictionary with Metrics enum names as keys
            dimension_info: Optional DimensionInfo with dimension details

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
        try:
            column: Union[SQALikeColumn, Column] = self._get_column_name()
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

        evaluation = self._evaluate_test_condition(metric_values)
        result_message = self._format_result_message(metric_values)
        test_result_values = self._get_test_result_values(metric_values)

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(evaluation["matched"]),
            result_message,
            test_result_values,
            row_count=count,
            passed_rows=evaluation["passed_rows"],
        )

    def _run_dimensional_validation(self) -> List[DimensionResult]:
        """Execute dimensional validation for column values to be unique

        The new approach runs separate queries for each dimension column instead of
        combining them with GROUP BY. For example, if dimensionColumns = ["country", "age"],
        this method will:
        1. Run one query: GROUP BY country -> {"Spain": result1, "Argentina": result2}
        2. Run another query: GROUP BY age -> {"10": result3, "12": result4}

        Returns:
            List[DimensionResult]: List of dimension-specific test results
        """
        try:
            dimension_columns = self.test_case.dimensionColumns or []
            if not dimension_columns:
                return []

            column: Union[SQALikeColumn, Column] = self._get_column_name()

            # Use shared method to get metrics to compute
            metrics_to_compute = self._get_metrics_to_compute()

            dimension_results = []
            for dimension_column in dimension_columns:
                try:
                    dimension_col = self._get_column_name(dimension_column)

                    single_dimension_results = self._execute_dimensional_validation(
                        column, dimension_col, metrics_to_compute
                    )

                    dimension_results.extend(single_dimension_results)

                except Exception as exc:
                    logger.warning(
                        f"Error executing dimensional query for column {dimension_column}: {exc}"
                    )
                    continue

            return dimension_results

        except Exception as exc:
            logger.warning(f"Error executing dimensional validation: {exc}")
            return []

    @abstractmethod
    def _get_column_name(self, column_name: Optional[str] = None):
        """Get the column object for the given column name

        If column_name is None, returns the main column being validated.
        If column_name is provided, returns the column object for that specific column.

        Args:
            column_name: Optional column name. If None, returns the main validation column.

        Returns:
            Column object (Column, SQALikeColumn, etc.)
        """
        raise NotImplementedError

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

        Returns:
            List[DimensionResult]: List of dimension results for this dimension column
            Example: [DimensionResult(dimensionValues={"country": "Spain"}, ...), DimensionResult(dimensionValues={"country": "Argentina"}, ...)]
        """
        raise NotImplementedError
