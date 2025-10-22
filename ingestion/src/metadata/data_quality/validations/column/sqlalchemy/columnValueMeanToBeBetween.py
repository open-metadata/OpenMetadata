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

from typing import List, Optional

from sqlalchemy import Column, case, func, inspect, literal

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_SUM_VALUE_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
)
from metadata.data_quality.validations.column.base.columnValueMeanToBeBetween import (
    BaseColumnValueMeanToBeBetweenValidator,
)
from metadata.data_quality.validations.impact_score import DEFAULT_TOP_DIMENSIONS
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValueMeanToBeBetweenValidator(
    BaseColumnValueMeanToBeBetweenValidator, SQAValidatorMixin
):
    """Validator for column value mean to be between test case"""

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
        """Execute dimensional validation for mean with proper weighted aggregation

        Uses the statistical aggregation helper to:
        1. Compute raw metrics (sum, count, mean) per dimension
        2. Calculate impact score based on whether mean is within bounds
        3. Aggregate "Others" using weighted mean: SUM(sums) / SUM(counts)

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
            min_bound = test_params["minValueForMeanInCol"]
            max_bound = test_params["maxValueForMeanInCol"]

            # Define raw aggregate expressions for CTE1
            metric_expressions = {
                DIMENSION_SUM_VALUE_KEY: func.sum(column),  # For weighted mean calc
                DIMENSION_TOTAL_COUNT_KEY: func.count(),  # For impact scoring
                "mean": func.avg(column),  # The statistical metric
            }

            # Define how to compute failed_count from CTE1
            def build_failed_count(cte1):
                mean_col = getattr(cte1.c, "mean")
                count_col = getattr(cte1.c, DIMENSION_TOTAL_COUNT_KEY)
                return case(
                    ((mean_col < min_bound) | (mean_col > max_bound), count_col),
                    else_=literal(0),
                )

            # Define how to compute final mean value
            def build_mean_final(cte):
                from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
                    DIMENSION_GROUP_LABEL,
                    DIMENSION_OTHERS_LABEL,
                )

                return case(
                    [
                        (
                            getattr(cte.c, DIMENSION_GROUP_LABEL)
                            != DIMENSION_OTHERS_LABEL,
                            func.max(getattr(cte.c, "mean")),  # Top N: use pre-computed
                        )
                    ],
                    else_=(  # Others: recompute weighted mean
                        func.sum(getattr(cte.c, DIMENSION_SUM_VALUE_KEY))
                        / func.sum(getattr(cte.c, DIMENSION_TOTAL_COUNT_KEY))
                    ),
                )

            # Execute query with statistical aggregation
            result_rows = self._execute_with_others_aggregation_statistical(
                dimension_col,
                metric_expressions,
                build_failed_count,
                final_metric_builders={"mean": build_mean_final},
                exclude_from_final=[DIMENSION_SUM_VALUE_KEY],  # Don't output sum_value
                top_dimensions_count=DEFAULT_TOP_DIMENSIONS,
            )

            # Process results
            for row in result_rows:
                mean_value = row.get("mean")

                if mean_value is None:
                    continue

                # Build metric values
                metric_values = {
                    Metrics.MEAN.name: mean_value,
                }

                # Evaluate condition
                evaluation = self._evaluate_test_condition(metric_values, test_params)

                # Add mean to row (already present from final query)
                row_with_mean = dict(row)
                row_with_mean[Metrics.MEAN.name] = mean_value

                # Create dimension result
                dimension_result = self._create_dimension_result(
                    row_with_mean,
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
