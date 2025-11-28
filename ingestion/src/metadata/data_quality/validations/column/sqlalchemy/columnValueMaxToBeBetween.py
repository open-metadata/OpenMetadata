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
Validator for column value max to be between test case
"""

from typing import List, Optional

from sqlalchemy import Column

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_TOTAL_COUNT_KEY,
)
from metadata.data_quality.validations.column.base.columnValueMaxToBeBetween import (
    BaseColumnValueMaxToBeBetweenValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValueMaxToBeBetweenValidator(
    BaseColumnValueMaxToBeBetweenValidator, SQAValidatorMixin
):
    """Validator for column value max to be between test case"""

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
        """Execute dimensional validation for max with proper aggregation

        Uses the statistical aggregation helper to:
        1. Compute raw metrics (max) per dimension
        2. Calculate impact score based on whether max is within bounds
        3. Aggregate "Others" using MAX(individual_maxes)

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
            row_count_expr = Metrics.ROW_COUNT().fn()
            max_expr = Metrics.MAX(column).fn()
            metric_expressions = {
                DIMENSION_TOTAL_COUNT_KEY: row_count_expr,
                Metrics.MAX.name: max_expr,
            }

            failed_count_builder = (
                lambda cte, row_count_expr: self._get_validation_checker(
                    test_params
                ).build_agg_level_violation_sqa(
                    [getattr(cte.c, Metrics.MAX.name)], row_count_expr
                )
            )

            normalized_dimension = self._get_normalized_dimension_expression(
                dimension_col
            )

            result_rows = self._run_dimensional_validation_query(
                source=self.runner.dataset,
                dimension_expr=normalized_dimension,
                metric_expressions=metric_expressions,
                failed_count_builder=failed_count_builder,
            )

            for row in result_rows:
                max_value = row.get(Metrics.MAX.name)

                if max_value is None:
                    continue

                metric_values = {
                    Metrics.MAX.name: max_value,
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
