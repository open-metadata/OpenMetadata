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

from sqlalchemy import Column, case, func

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_TOTAL_COUNT_KEY,
)
from metadata.data_quality.validations.column.base.columnValueMeanToBeBetween import (
    BaseColumnValueMeanToBeBetweenValidator,
)
from metadata.data_quality.validations.impact_score import DEFAULT_TOP_DIMENSIONS
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    DIMENSION_GROUP_LABEL,
    DIMENSION_OTHERS_LABEL,
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
            metric_expressions = {
                Metrics.SUM.name: Metrics.SUM(column).fn(),
                Metrics.COUNT.name: Metrics.COUNT(column).fn(),
                Metrics.MEAN.name: Metrics.MEAN(column).fn(),
                DIMENSION_TOTAL_COUNT_KEY: func.count(),
            }

            def build_mean_final(cte):
                return case(
                    [
                        (
                            getattr(cte.c, DIMENSION_GROUP_LABEL)
                            != DIMENSION_OTHERS_LABEL,
                            func.max(getattr(cte.c, Metrics.MEAN.name)),
                        )
                    ],
                    else_=(
                        func.sum(getattr(cte.c, Metrics.SUM.name))
                        / func.sum(getattr(cte.c, Metrics.COUNT.name))
                    ),
                )

            result_rows = self._execute_with_others_aggregation_statistical(
                dimension_col,
                metric_expressions,
                self._get_validation_checker(test_params).get_sqa_failed_rows_builder(
                    Metrics.MEAN.name, DIMENSION_TOTAL_COUNT_KEY
                ),
                final_metric_builders={Metrics.MEAN.name: build_mean_final},
                exclude_from_results=[Metrics.SUM.name, Metrics.COUNT.name],
                top_dimensions_count=DEFAULT_TOP_DIMENSIONS,
            )

            for row in result_rows:
                mean_value = row.get(Metrics.MEAN.name)

                if mean_value is None:
                    continue

                metric_values = {
                    Metrics.MEAN.name: mean_value,
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
