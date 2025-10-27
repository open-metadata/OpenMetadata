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
Validator for column value to be in set test case
"""

from typing import List, Optional

from sqlalchemy import Column, inspect, literal

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesToBeInSet import (
    BaseColumnValuesToBeInSetValidator,
)
from metadata.data_quality.validations.impact_score import DEFAULT_TOP_DIMENSIONS
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValuesToBeInSetValidator(
    BaseColumnValuesToBeInSetValidator, SQAValidatorMixin
):
    """Validator for column value to be in set test case"""

    def _get_column_name(self, column_name: Optional[str] = None) -> Column:
        """Get column object for the given column name

        If column_name is None, returns the main column being validated.
        If column_name is provided, returns the column object for that specific column.

        Args:
            column_name: Optional column name. If None, returns the main validation column.

        Returns:
            Column: Column object
        """
        if column_name is None:
            # Get the main column being validated (original behavior)
            return self.get_column_name(
                self.test_case.entityLink.root,
                inspect(self.runner.dataset).c,
            )
        else:
            # Get a specific column by name (for dimension columns)
            return self.get_column_name(
                column_name,
                inspect(self.runner.dataset).c,
            )

    def _run_results(self, metric: Metrics, column: Column, **kwargs) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        return self.run_query_results(self.runner, metric, column, **kwargs)

    def compute_row_count(self, column: Column):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for

        Raises:
            NotImplementedError:
        """
        return self._compute_row_count(self.runner, column)

    def _execute_dimensional_validation(
        self,
        column: Column,
        dimension_col: Column,
        metrics_to_compute: dict,
        test_params: dict,
    ) -> List[DimensionResult]:
        """Execute dimensional query with impact scoring and Others aggregation

        Calculates impact scores for all dimension values and aggregates
        low-impact dimensions into "Others" category using CTEs.

        Args:
            column: The column being validated
            dimension_col: Single Column object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping Metrics enum names to Metrics objects
            test_params: Dictionary with test-specific parameters (allowed_values, match_enum)

        Returns:
            List[DimensionResult]: Top N dimensions by impact score plus "Others"
        """
        dimension_results = []

        try:
            allowed_values = test_params["allowed_values"]
            match_enum = test_params["match_enum"]

            # Build metric expressions using enum names as keys
            metric_expressions = {}
            for metric_name, metric in metrics_to_compute.items():
                metric_instance = metric.value(column)
                if metric_name == Metrics.COUNT_IN_SET.name:
                    metric_instance.values = allowed_values
                metric_expressions[metric_name] = metric_instance.fn()

            if match_enum and Metrics.ROW_COUNT.name in metric_expressions:
                # Enum mode: failed = total - matched
                metric_expressions[DIMENSION_TOTAL_COUNT_KEY] = metric_expressions[
                    Metrics.ROW_COUNT.name
                ]
                metric_expressions[DIMENSION_FAILED_COUNT_KEY] = (
                    metric_expressions[Metrics.ROW_COUNT.name]
                    - metric_expressions[Metrics.COUNT_IN_SET.name]
                )
            else:
                # Non-enum mode: no real concept of failure, use count_in_set for ordering
                metric_expressions[DIMENSION_TOTAL_COUNT_KEY] = metric_expressions[
                    Metrics.COUNT_IN_SET.name
                ]
                metric_expressions[DIMENSION_FAILED_COUNT_KEY] = literal(0)

            result_rows = self._execute_with_others_aggregation(
                dimension_col, metric_expressions, DEFAULT_TOP_DIMENSIONS
            )

            for row in result_rows:
                # Build metric_values dict using helper method
                metric_values = self._build_metric_values_from_row(
                    row, metrics_to_compute, test_params
                )

                # Evaluate test condition
                evaluation = self._evaluate_test_condition(metric_values, test_params)

                # Create dimension result using helper method
                dimension_result = self._create_dimension_result(
                    row, dimension_col.name, metric_values, evaluation, test_params
                )

                dimension_results.append(dimension_result)

        except Exception as exc:
            logger.warning(f"Error executing dimensional query: {exc}")
            logger.debug("Full error details: ", exc_info=True)

        return dimension_results
