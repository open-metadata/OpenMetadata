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
Validator for column value stddev to be between test case
"""

from typing import Any, Dict, List, Optional

from sqlalchemy import Column, case, func, select

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_IMPACT_SCORE_KEY,
    DIMENSION_OTHERS_LABEL,
    DIMENSION_TOTAL_COUNT_KEY,
    DIMENSION_VALUE_KEY,
)
from metadata.data_quality.validations.column.base.columnValueStdDevToBeBetween import (
    BaseColumnValueStdDevToBeBetweenValidator,
)
from metadata.data_quality.validations.impact_score import (
    DEFAULT_TOP_DIMENSIONS,
    get_impact_score_expression,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    DIMENSION_GROUP_LABEL,
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValueStdDevToBeBetweenValidator(
    BaseColumnValueStdDevToBeBetweenValidator, SQAValidatorMixin
):
    """Validator for column value stddev to be between test case"""

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
        """Execute dimensional validation for stddev using two-pass approach

        Two-pass query strategy for accurate "Others" stddev:

        Pass 1: Compute stddev for top N dimensions using CTE-based aggregation
                Returns "Others" row with stddev=None (cannot aggregate stddevs)

        Pass 2: Recompute stddev for "Others" from raw table data
                Query: SELECT STDDEV(column) WHERE dimension NOT IN (top_N_values)
                Uses native database STDDEV function (works across all dialects)

        This approach ensures mathematical accuracy and dialect compatibility.

        Args:
            column: The column being validated
            dimension_col: The dimension column to group by
            metrics_to_compute: Dict mapping metric names to Metrics enums
            test_params: Test parameters (min/max bounds)

        Returns:
            List[DimensionResult]: Top N dimensions plus "Others" with accurate stddev
        """
        dimension_results = []

        try:
            # ==================== PASS 1: Top N Dimensions ====================
            metric_expressions = {
                DIMENSION_TOTAL_COUNT_KEY: Metrics.ROW_COUNT().fn(),
                Metrics.STDDEV.name: Metrics.STDDEV(column).fn(),
            }

            def build_stddev_final(cte):
                """For top N: use pre-computed stddev. For Others: return None."""
                return case(
                    [
                        (
                            getattr(cte.c, DIMENSION_GROUP_LABEL)
                            != DIMENSION_OTHERS_LABEL,
                            func.max(getattr(cte.c, Metrics.STDDEV.name)),
                        )
                    ],
                    else_=None,
                )

            failed_count_builder = self._get_validation_checker(
                test_params
            ).get_sqa_failed_rows_builder(
                {Metrics.STDDEV.name: Metrics.STDDEV.name},
                DIMENSION_TOTAL_COUNT_KEY,
            )

            result_rows = self._execute_with_others_aggregation_statistical(
                dimension_col,
                metric_expressions,
                failed_count_builder,
                final_metric_builders={
                    Metrics.STDDEV.name: build_stddev_final,
                },
                top_dimensions_count=DEFAULT_TOP_DIMENSIONS,
            )

            # ==================== PASS 2: Recompute "Others" Stddev ====================
            # Convert immutable RowMapping objects to mutable dicts
            result_rows = [dict(row) for row in result_rows]

            # Separate top N dimensions from "Others" row
            top_n_rows = [
                row
                for row in result_rows
                if row[DIMENSION_VALUE_KEY] != DIMENSION_OTHERS_LABEL
            ]

            has_others = len(top_n_rows) < len(result_rows)

            # Recompute "Others" only if it existed in Pass 1
            if has_others:
                if recomputed_others := self._compute_others_stddev(
                    column,
                    dimension_col,
                    failed_count_builder,
                    top_n_rows,
                ):
                    result_rows = top_n_rows + [recomputed_others]
                else:
                    result_rows = top_n_rows
            else:
                result_rows = top_n_rows

            # ==================== Process Results ====================
            for row in result_rows:
                stddev_value = row.get(Metrics.STDDEV.name)

                if stddev_value is None:
                    logger.debug(
                        "Skipping dimension '%s=%s' with None stddev",
                        dimension_col.name,
                        row.get(DIMENSION_VALUE_KEY),
                    )
                    continue

                metric_values = {
                    Metrics.STDDEV.name: stddev_value,
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

    def _compute_others_stddev(
        self,
        column: Column,
        dimension_col: Column,
        failed_count_builder,
        top_dimension_values: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """Recompute stddev and metrics for "Others" dimension group.

        Uses two-pass approach: Pass 1 computed top N dimensions, this computes
        "Others" by rerunning stddev on all rows NOT in top N dimensions.

        Args:
            column: The column being validated
            dimension_col: The dimension column to group by
            failed_count_builder: SQL expression builder for failed count (from checker)
            result_rows: Results from Pass 1 WITHOUT "Others" row (only top N dimensions)

        Returns:
            New "Others" row dict with recomputed metrics, or None if computation failed
        """
        # Extract top N dimension values (result_rows no longer contains "Others")

        # If no top dimensions to exclude, cannot compute "Others"
        if not top_dimension_values:
            return None

        try:
            # Compute stddev directly on base table with WHERE filter
            stddev_expr = Metrics.STDDEV(column).fn()
            total_count_expr = Metrics.ROW_COUNT().fn()

            # Create stats subquery with WHERE filter for "Others" group
            # Query: SELECT STDDEV(col), COUNT(*) FROM table WHERE dimension NOT IN (top_N)
            # Extract just the dimension values from the top N result rows
            top_dimension_value_list = [
                row[DIMENSION_VALUE_KEY] for row in top_dimension_values
            ]
            stats_subquery = (
                select(
                    [
                        stddev_expr.label(Metrics.STDDEV.name),
                        total_count_expr.label(DIMENSION_TOTAL_COUNT_KEY),
                    ]
                )
                .select_from(self.runner.dataset)
                .where(dimension_col.notin_(top_dimension_value_list))
            ).alias("others_stats")

            # Apply failed_count builder to stats subquery (reused from Pass 1)
            failed_count_expr = failed_count_builder(stats_subquery)

            # Calculate impact score in SQL (same expression as Pass 1)
            total_count_col = getattr(stats_subquery.c, DIMENSION_TOTAL_COUNT_KEY)
            impact_score_expr = get_impact_score_expression(
                failed_count_expr, total_count_col
            )

            # Final query: stddev, total_count, failed_count, impact_score
            # All computed in SQL just like Pass 1
            others_query = select(
                [
                    getattr(stats_subquery.c, Metrics.STDDEV.name),
                    total_count_col,
                    failed_count_expr.label(DIMENSION_FAILED_COUNT_KEY),
                    impact_score_expr.label(DIMENSION_IMPACT_SCORE_KEY),
                ]
            ).select_from(stats_subquery)

            result = self.runner.session.execute(others_query).fetchone()

            if result:
                others_stddev, total_count, failed_count, impact_score = result

                logger.debug(
                    "Recomputed 'Others' (SQL): stddev=%s, failed=%d/%d, impact=%.3f",
                    others_stddev,
                    failed_count,
                    total_count,
                    impact_score,
                )

                # Return new "Others" row with SQL-computed values
                return {
                    DIMENSION_VALUE_KEY: DIMENSION_OTHERS_LABEL,
                    Metrics.STDDEV.name: others_stddev,
                    DIMENSION_TOTAL_COUNT_KEY: total_count,
                    DIMENSION_FAILED_COUNT_KEY: failed_count,
                    DIMENSION_IMPACT_SCORE_KEY: impact_score,
                }

            return None

        except Exception as exc:
            logger.warning(
                "Failed to recompute 'Others' stddev, will be excluded: %s", exc
            )
            logger.debug("Full error details: ", exc_info=True)
            return None
