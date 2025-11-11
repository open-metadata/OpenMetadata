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
Validator for column values to be between test case
"""
import math
from typing import List, Optional

from sqlalchemy import Column, func

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
    DIMENSION_VALUE_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesToBeBetween import (
    BaseColumnValuesToBeBetweenValidator,
)
from metadata.data_quality.validations.impact_score import DEFAULT_TOP_DIMENSIONS
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValuesToBeBetweenValidator(
    BaseColumnValuesToBeBetweenValidator, SQAValidatorMixin
):
    """Validator for column values to be between test case"""

    def _run_results(self, metric: Metrics, column: Column) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        return self.run_query_results(self.runner, metric, column)

    def _execute_dimensional_validation(
        self,
        column: Column,
        dimension_col: Column,
        metrics_to_compute: dict,
        test_params: dict,
    ) -> List[DimensionResult]:
        """Execute dimensional validation for values to be between with proper aggregation

        Uses the statistical aggregation helper to:
        1. Compute raw metrics (min, max) per dimension
        2. Calculate impact score based on whether both min and max are within bounds
        3. Aggregate "Others" using MIN(individual_mins) and MAX(individual_maxes)

        Args:
            column: The column being validated
            dimension_col: The dimension column to group by
            metrics_to_compute: Dict mapping metric names to Metrics enums
            test_params: Test parameters (min/max bounds)

        Returns:
            List[DimensionResult]: Top N dimensions plus "Others"
        """
        dimension_results = []

        try:
            metric_expressions = {
                DIMENSION_TOTAL_COUNT_KEY: Metrics.ROW_COUNT().fn(),
                Metrics.MIN.name: Metrics.MIN(column).fn(),
                Metrics.MAX.name: Metrics.MAX(column).fn(),
            }

            def build_min_final(cte):
                """Aggregate MIN values: take minimum of all mins"""
                return func.min(getattr(cte.c, Metrics.MIN.name))

            def build_max_final(cte):
                """Aggregate MAX values: take maximum of all maxes"""
                return func.max(getattr(cte.c, Metrics.MAX.name))

            result_rows = self._execute_with_others_aggregation_statistical(
                dimension_col,
                metric_expressions,
                self._get_validation_checker(test_params).get_sqa_failed_rows_builder(
                    {
                        Metrics.MIN.name: Metrics.MIN.name,
                        Metrics.MAX.name: Metrics.MAX.name,
                    },
                    DIMENSION_TOTAL_COUNT_KEY,
                ),
                final_metric_builders={
                    Metrics.MIN.name: build_min_final,
                    Metrics.MAX.name: build_max_final,
                },
                top_dimensions_count=DEFAULT_TOP_DIMENSIONS,
            )

            for row in result_rows:
                min_value = row.get(Metrics.MIN.name)
                max_value = row.get(Metrics.MAX.name)

                if min_value is None or max_value is None:
                    logger.warning(
                        "Skipping '%s=%s' dimension since 'min' or 'max' are 'None'",
                        dimension_col.name,
                        row.get(DIMENSION_VALUE_KEY),
                    )
                    continue

                # Normalize values (convert date to datetime if needed)
                min_value = self._normalize_metric_value(min_value, is_min=True)
                max_value = self._normalize_metric_value(max_value, is_min=False)

                metric_values = {
                    Metrics.MIN.name: min_value,
                    Metrics.MAX.name: max_value,
                    DIMENSION_TOTAL_COUNT_KEY: row.get(DIMENSION_TOTAL_COUNT_KEY),
                    DIMENSION_FAILED_COUNT_KEY: row.get(DIMENSION_FAILED_COUNT_KEY),
                }

                evaluation = self._evaluate_test_condition(metric_values, test_params)

                dimension_result = self._create_dimension_result(
                    row,
                    dimension_col.name,
                    metric_values,
                    evaluation,
                    test_params,
                )

                dimension_results.append(dimension_result)

        except Exception as exc:
            logger.warning(f"Error executing dimensional query: {exc}")
            logger.debug("Full error details: ", exc_info=True)

        return dimension_results

    def compute_row_count(self, column: Column, min_bound: int, max_bound: int):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for
            min_bound (_type_): min bound to filter out rows within the bound
            max_bound (_type_): max bound to filter out rows within the bound

        Raises:
            NotImplementedError:
        """
        row_count = self._compute_row_count(self.runner, column)
        filters = []
        if not isinstance(min_bound, (int, float)) or min_bound > -math.inf:
            filters.append((column, "lt", min_bound))
        if not isinstance(min_bound, (int, float)) or max_bound < math.inf:
            filters.append((column, "gt", max_bound))
        failed_rows = self._compute_row_count_between(
            self.runner,
            column,
            {
                "filters": filters,
                "or_filter": True,
            },
        )

        return row_count, failed_rows
