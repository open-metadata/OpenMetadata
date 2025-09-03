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

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.generated.schema.tests.basic import (
    DimensionResult,
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = test_suite_logger()

VALUE_COUNT = "valueCount"
UNIQUE_COUNT = "uniqueCount"


class BaseColumnValuesToBeUniqueValidator(BaseTestValidator):
    """Validator for column values to be unique test case"""

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

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(count == unique_count),
            f"Found valuesCount={count} vs. uniqueCount={unique_count}. "
            "Both counts should be equal for column values to be unique.",
            [
                TestResultValue(name=VALUE_COUNT, value=str(count)),
                TestResultValue(name=UNIQUE_COUNT, value=str(unique_count)),
            ],
            row_count=count,
            passed_rows=unique_count,
        )

    def _run_dimensional_validation(self) -> List[DimensionResult]:
        """Execute dimensional validation for column values to be unique

        This method implements the dimensional logic following the same pattern as _run_validation:
        1. Get the column to validate
        2. Get dimension column objects using the generic _get_column_name method
        3. Execute dimensional query (engine-specific implementation with GROUP BY)
        4. Process results (same logic, but for each dimension group)

        Returns:
            List[DimensionResult]: List of dimension-specific test results
        """
        try:
            # Get dimension columns from test case
            dimension_columns = self.test_case.dimensionColumns or []
            if not dimension_columns:
                return []

            # Get the column to validate (same as _run_validation)
            column: Union[SQALikeColumn, Column] = self._get_column_name()

            # Get dimension column objects using the generic _get_column_name method
            # This reuses the same logic for getting column objects
            dimension_cols = [self._get_column_name(dim) for dim in dimension_columns]

            # Define the metrics to compute (same as _run_validation)
            # These are the same metrics but will be grouped by dimensions
            metrics_to_compute = {
                "count": Metrics.COUNT,
                "unique_count": Metrics.UNIQUE_COUNT,
            }

            # Execute dimensional query using the defined metrics and dimension columns
            # This will return multiple rows: one per dimension combination
            # Each row contains: dim1, dim2, count, unique_count
            dimension_results = self._execute_dimensional_query(
                column, dimension_cols, metrics_to_compute
            )
            return dimension_results

        except Exception as exc:
            logger.warning(f"Error executing dimensional validation: {exc}")
            # Return empty list on error (test continues without dimensions)
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
    def _execute_dimensional_query(
        self,
        column: Union[SQALikeColumn, Column],
        dimension_cols: List[Union[SQALikeColumn, Column]],
        metrics_to_compute: dict,
    ) -> List[DimensionResult]:
        """Execute dimensional query for this specific test and engine

        This method should implement the engine-specific logic for executing
        dimensional queries using the metrics defined by the base class.

        The method is metric-agnostic - it receives a dictionary of metrics to compute
        and should execute a GROUP BY query that returns multiple rows (one per dimension combination).

        For the uniqueness test, metrics_to_compute might be:
        {'count': Metrics.COUNT, 'unique_count': Metrics.UNIQUE_COUNT}

        For other tests, it could be:
        {'min': Metrics.MIN, 'max': Metrics.MAX}
        {'count_in_set': Metrics.COUNT_IN_SET}
        {'null_count': Metrics.NULL_MISSING_COUNT}

        The key differences from _run_results:
        1. Uses GROUP BY to group by dimension columns
        2. Returns multiple rows (one per dimension combination)
        3. Each row contains dimension values + metric results
        4. Metric-agnostic - works with any set of metrics

        Args:
            column: The column being validated (same as used in _run_validation)
            dimension_cols: List of Column objects corresponding to dimension columns
            metrics_to_compute: Dictionary mapping metric names to Metrics objects

        Returns:
            List[DimensionResult]: List of dimension-specific test results
        """
        raise NotImplementedError
