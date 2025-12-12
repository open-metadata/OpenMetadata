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
Validator for column value median to be between test case
"""

from typing import List, Optional

from sqlalchemy import Column, select

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_TOTAL_COUNT_KEY,
    DIMENSION_VALUE_KEY,
)
from metadata.data_quality.validations.column.base.columnValueMedianToBeBetween import (
    BaseColumnValueMedianToBeBetweenValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

# CTE name for normalized dimension
CTE_NORMALIZED_DIMENSION = "normalized_dimension"


class ColumnValueMedianToBeBetweenValidator(
    BaseColumnValueMedianToBeBetweenValidator, SQAValidatorMixin
):
    """Validator for column value median to be between test case"""

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
        """Execute dimensional validation for median using normalized CTE approach.

        Strategy:
        1. Normalize dimension values in CTE (simple column, no CASE in GROUP BY)
        2. Use Metrics.MEDIAN on CTE columns (automatically handles CTE reference)
        3. Build dimensional aggregation query with custom CTE chain
        4. Pass 2: Recompute "Others" median (existing logic, unchanged)

        This approach avoids MySQL ONLY_FULL_GROUP_BY error by ensuring MedianFn's
        correlated subquery references a simple column that IS in the GROUP BY clause.

        Args:
            column: The column being validated
            dimension_col: The dimension column to group by
            metrics_to_compute: Dict mapping metric names to Metrics enums (unused)
            test_params: Test parameters (minValue, maxValue)

        Returns:
            List[DimensionResult]: Top N dimensions plus "Others" with accurate median
        """
        dimension_results = []

        try:
            # Handle both Table and CTE/Alias cases (when partitioning is enabled)
            if hasattr(self.runner.dataset, "__table__"):
                table = self.runner.dataset.__table__
            else:
                table = self.runner.dataset

            normalized_dimension = self._get_normalized_dimension_expression(
                dimension_col
            )

            # This avoids GROUP BY on CASE expression which causes correlation issues
            normalized_dim_cte = (
                select(
                    [
                        normalized_dimension.label("normalized_dim"),
                        column.label("col_value"),
                    ]
                ).select_from(table)
            ).cte(CTE_NORMALIZED_DIMENSION)

            normalized_dim_col = normalized_dim_cte.c.normalized_dim
            col_value_col = normalized_dim_cte.c.col_value

            row_count_expr = Metrics.ROW_COUNT().fn()
            median_expr = add_props(dimension_col="normalized_dim")(
                Metrics.MEDIAN.value
            )(col_value_col).fn()
            metric_expressions = {
                DIMENSION_TOTAL_COUNT_KEY: row_count_expr,
                Metrics.MEDIAN.name: median_expr,
            }

            failed_count_builder = (
                lambda cte, row_count_expr: self._get_validation_checker(
                    test_params
                ).build_agg_level_violation_sqa(
                    [getattr(cte.c, Metrics.MEDIAN.name)], row_count_expr
                )
            )

            result_rows = self._run_dimensional_validation_query(
                source=normalized_dim_cte,
                dimension_expr=normalized_dim_col,
                metric_expressions=metric_expressions,
                others_metric_expressions_builder=self._get_others_metric_expressions_builder(
                    test_params
                ),
                failed_count_builder=failed_count_builder,
            )
            for row in result_rows:
                median_value = row.get(Metrics.MEDIAN.name)

                if median_value is None:
                    logger.debug(
                        "Skipping dimension '%s=%s' with None median",
                        dimension_col.name,
                        row.get(DIMENSION_VALUE_KEY),
                    )
                    continue

                metric_values = {Metrics.MEDIAN.name: median_value}
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

    def _get_others_metric_expressions_builder(self, test_params):
        def build_others_metric_expressions(others_source):
            col = others_source.c.col_value
            row_count_expr = Metrics.ROW_COUNT().fn()
            median_expr = Metrics.MEDIAN.value(col).fn()

            return {
                DIMENSION_TOTAL_COUNT_KEY: row_count_expr,
                Metrics.MEDIAN.name: median_expr,
            }

        return build_others_metric_expressions
