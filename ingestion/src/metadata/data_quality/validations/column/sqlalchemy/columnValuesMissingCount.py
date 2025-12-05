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
Validator for column value missing count to be equal test case
"""

from typing import List, Optional

from sqlalchemy import Column, func

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesMissingCount import (
    BaseColumnValuesMissingCountValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValuesMissingCountValidator(
    BaseColumnValuesMissingCountValidator, SQAValidatorMixin
):
    """Validator for column value missing count to be equal test case"""

    def _run_results(self, metric: Metrics, column: Column, **kwargs) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        return self.run_query_results(self.runner, metric, column, **kwargs)

    def _execute_dimensional_validation(
        self,
        column: Column,
        dimension_col: Column,
        metrics_to_compute: dict,
        test_params: dict,
    ) -> List[DimensionResult]:
        """Execute dimensional validation for missing count with deviation recalculation

        Uses statistical aggregation to:
        1. Compute total_missing_count per dimension (NULL + optional custom values)
        2. Calculate deviation = abs(actual - expected) per dimension
        3. Aggregate "Others" and recalculate deviation from summed missing counts

        Args:
            column: The column being validated
            dimension_col: The dimension column to group by
            metrics_to_compute: Dict mapping metric names to Metrics enums
            test_params: Test parameters (MISSING_VALUE_MATCH, MISSING_COUNT_VALUE)

        Returns:
            List[DimensionResult]: Top N dimensions plus "Others"
        """
        dimension_results = []

        try:
            missing_values = test_params.get(self.MISSING_VALUE_MATCH)
            expected_missing_count = test_params.get(self.MISSING_COUNT_VALUE, 0)

            row_count_expr = Metrics.ROW_COUNT().fn()
            total_missing_expr = Metrics.NULL_MISSING_COUNT(column).fn()

            if missing_values:
                total_missing_expr = (
                    total_missing_expr
                    + add_props(values=missing_values)(Metrics.COUNT_IN_SET.value)(
                        column
                    ).fn()
                )

            metric_expressions = {
                self.TOTAL_MISSING_COUNT: total_missing_expr,
                DIMENSION_TOTAL_COUNT_KEY: row_count_expr,
                DIMENSION_FAILED_COUNT_KEY: func.abs(
                    total_missing_expr - expected_missing_count
                ),
            }

            normalized_dimension = self._get_normalized_dimension_expression(
                dimension_col
            )

            result_rows = self._run_dimensional_validation_query(
                source=self.runner.dataset,
                dimension_expr=normalized_dimension,
                metric_expressions=metric_expressions,
            )

            for row in result_rows:
                total_missing_count = row.get(self.TOTAL_MISSING_COUNT)

                if total_missing_count is None:
                    continue

                metric_values = {
                    self.TOTAL_MISSING_COUNT: total_missing_count,
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
