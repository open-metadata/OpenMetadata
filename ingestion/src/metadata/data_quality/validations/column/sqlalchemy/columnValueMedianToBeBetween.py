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

from typing import Any, Dict, List, Optional

from sqlalchemy import Column, case, func, literal, select

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_IMPACT_SCORE_KEY,
    DIMENSION_NULL_LABEL,
    DIMENSION_OTHERS_LABEL,
    DIMENSION_TOTAL_COUNT_KEY,
    DIMENSION_VALUE_KEY,
)
from metadata.data_quality.validations.column.base.columnValueMedianToBeBetween import (
    BaseColumnValueMedianToBeBetweenValidator,
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
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

# CTE names for dimensional validation query chain
CTE_NORMALIZED_DIMENSION = "normalized_dimension"
CTE_DIMENSION_RAW_METRICS = "dimension_raw_metrics"
CTE_STATS_WITH_IMPACT = "stats_with_impact"
CTE_TOP_DIMENSIONS = "top_dimensions"
CTE_CATEGORIZED = "categorized"


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
            # ==================== PASS 1: Top N Dimensions ====================
            table = self.runner.dataset.__table__

            # Step 1: Build normalized dimension expression
            normalized_dimension = case(
                [
                    (dimension_col.is_(None), literal(DIMENSION_NULL_LABEL)),
                    (
                        func.upper(dimension_col) == "NULL",
                        literal(DIMENSION_NULL_LABEL),
                    ),
                ],
                else_=dimension_col,
            )

            # Step 2: Create CTE with normalized dimension as simple column
            # This avoids GROUP BY on CASE expression which causes correlation issues
            normalized_dim_cte = (
                select(
                    [
                        normalized_dimension.label("normalized_dim"),
                        column.label("col_value"),
                    ]
                ).select_from(table)
            ).cte(CTE_NORMALIZED_DIMENSION)

            # Cache frequently accessed columns
            normalized_dim_col = normalized_dim_cte.c.normalized_dim
            col_value_col = normalized_dim_cte.c.col_value

            # Step 3: Build metric expressions using CTE columns
            # Metrics.MEDIAN will extract CTE name and generate correlation on simple column
            metric_expressions = {
                DIMENSION_TOTAL_COUNT_KEY: func.count(),
                Metrics.MEDIAN.name: add_props(dimension_col="normalized_dim")(
                    Metrics.MEDIAN.value
                )(col_value_col).fn(),
            }

            # Step 4: Build failed count checker
            failed_count_builder = self._get_validation_checker(
                test_params
            ).get_sqa_failed_rows_builder(
                {Metrics.MEDIAN.name: Metrics.MEDIAN.name},
                DIMENSION_TOTAL_COUNT_KEY,
            )

            # Step 5: Build dimensional aggregation query
            # Operating on normalized CTE, grouping by simple "normalized_dim" column

            # CTE 1: Raw metrics per dimension (from normalized CTE)
            raw_agg_columns = [normalized_dim_col.label(DIMENSION_VALUE_KEY)]
            for name, expr in metric_expressions.items():
                raw_agg_columns.append(expr.label(name))

            raw_aggregates = (
                select(raw_agg_columns)
                .select_from(normalized_dim_cte)
                .group_by(normalized_dim_col)  # Simple column!
            ).cte(CTE_DIMENSION_RAW_METRICS)

            # CTE 2: Add failed_count and impact_score
            total_count_col = getattr(raw_aggregates.c, DIMENSION_TOTAL_COUNT_KEY)
            failed_count_expr = failed_count_builder(raw_aggregates)
            impact_score_expr = get_impact_score_expression(
                failed_count_expr, total_count_col
            )

            stats_with_impact = (
                select(
                    [
                        *[col for col in raw_aggregates.c],
                        failed_count_expr.label(DIMENSION_FAILED_COUNT_KEY),
                        impact_score_expr.label(DIMENSION_IMPACT_SCORE_KEY),
                    ]
                ).select_from(raw_aggregates)
            ).cte(CTE_STATS_WITH_IMPACT)

            # CTE 3: Top N dimensions by impact score
            top_dimensions = (
                select([getattr(stats_with_impact.c, DIMENSION_VALUE_KEY)])
                .order_by(
                    getattr(stats_with_impact.c, DIMENSION_IMPACT_SCORE_KEY).desc()
                )
                .limit(DEFAULT_TOP_DIMENSIONS)
            ).cte(CTE_TOP_DIMENSIONS)

            # CTE 4: Categorize as top N or "Others"
            categorized = (
                select(
                    case(
                        [
                            (
                                getattr(stats_with_impact.c, DIMENSION_VALUE_KEY).in_(
                                    select(
                                        [getattr(top_dimensions.c, DIMENSION_VALUE_KEY)]
                                    )
                                ),
                                getattr(stats_with_impact.c, DIMENSION_VALUE_KEY),
                            )
                        ],
                        else_=DIMENSION_OTHERS_LABEL,
                    ).label(DIMENSION_GROUP_LABEL),
                    *[
                        col
                        for col in stats_with_impact.c
                        if col.name != DIMENSION_VALUE_KEY
                    ],
                ).select_from(stats_with_impact)
            ).cte(CTE_CATEGORIZED)

            # Step 6: Final aggregation for "Others"
            # Cache column references for cleaner query building
            group_label_col = getattr(categorized.c, DIMENSION_GROUP_LABEL)
            total_count_categorized = getattr(categorized.c, DIMENSION_TOTAL_COUNT_KEY)
            median_col = getattr(categorized.c, Metrics.MEDIAN.name)
            failed_count_categorized = getattr(
                categorized.c, DIMENSION_FAILED_COUNT_KEY
            )
            impact_score_categorized = getattr(
                categorized.c, DIMENSION_IMPACT_SCORE_KEY
            )

            # Build aggregates
            summed_total_count = func.sum(total_count_categorized)
            summed_failed_count = func.sum(failed_count_categorized)
            max_impact_score = func.max(impact_score_categorized)

            # For "Others": median=None (recomputed in Pass 2)
            final_query = (
                select(
                    [
                        group_label_col.label(DIMENSION_VALUE_KEY),
                        summed_total_count.label(DIMENSION_TOTAL_COUNT_KEY),
                        case(
                            [
                                (
                                    group_label_col != DIMENSION_OTHERS_LABEL,
                                    func.max(median_col),
                                )
                            ],
                            else_=None,
                        ).label(Metrics.MEDIAN.name),
                        summed_failed_count.label(DIMENSION_FAILED_COUNT_KEY),
                        max_impact_score.label(DIMENSION_IMPACT_SCORE_KEY),
                    ]
                )
                .select_from(categorized)
                .group_by(group_label_col)
                .order_by(max_impact_score.desc())
            )

            # Execute Pass 1
            result_rows_raw = self.runner.session.execute(final_query).fetchall()
            result_rows = [dict(row._mapping) for row in result_rows_raw]

            # ==================== PASS 2: Recompute "Others" Median ====================
            top_n_rows = [
                row
                for row in result_rows
                if row[DIMENSION_VALUE_KEY] != DIMENSION_OTHERS_LABEL
            ]

            has_others = len(top_n_rows) < len(result_rows)

            if has_others and (
                recomputed_others := self._compute_others_median(
                    column,
                    dimension_col,
                    failed_count_builder,
                    top_n_rows,
                )
            ):
                result_rows = top_n_rows + [recomputed_others]
            else:
                result_rows = top_n_rows

            # ==================== Process Results ====================
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

    def _compute_others_median(
        self,
        column: Column,
        dimension_col: Column,
        failed_count_builder,
        result_rows: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """Recompute median and metrics for "Others" dimension group.

        Uses two-pass approach: Pass 1 computed top N dimensions, this computes
        "Others" by rerunning median on all rows NOT in top N dimensions.

        Args:
            column: The column being validated
            dimension_col: The dimension column to group by
            failed_count_builder: SQL expression builder for failed count (from checker)
            result_rows: Results from Pass 1 WITHOUT "Others" row (only top N dimensions)

        Returns:
            New "Others" row dict with recomputed metrics, or None if computation failed
        """
        top_dimension_values = [row[DIMENSION_VALUE_KEY] for row in result_rows]

        if not top_dimension_values:
            return None

        try:
            # Compute median directly on base table with WHERE filter
            median_expr = Metrics.MEDIAN(column).fn()
            total_count_expr = func.count()

            # Create stats subquery with WHERE filter for "Others" group
            # Query: SELECT MEDIAN(col), COUNT(*) FROM table WHERE dimension NOT IN (top_N)
            stats_subquery = (
                select(
                    [
                        median_expr.label(Metrics.MEDIAN.name),
                        total_count_expr.label(DIMENSION_TOTAL_COUNT_KEY),
                    ]
                )
                .select_from(self.runner.dataset)
                .where(dimension_col.notin_(top_dimension_values))
            ).alias("others_stats")

            # Cache column references
            median_col = getattr(stats_subquery.c, Metrics.MEDIAN.name)
            total_count_col = getattr(stats_subquery.c, DIMENSION_TOTAL_COUNT_KEY)

            # Apply failed_count builder to stats subquery (reused from Pass 1)
            failed_count_expr = failed_count_builder(stats_subquery)

            # Calculate impact score in SQL (same expression as Pass 1)
            impact_score_expr = get_impact_score_expression(
                failed_count_expr, total_count_col
            )

            # Final query: median, total_count, failed_count, impact_score
            others_query = select(
                [
                    median_col,
                    total_count_col,
                    failed_count_expr.label(DIMENSION_FAILED_COUNT_KEY),
                    impact_score_expr.label(DIMENSION_IMPACT_SCORE_KEY),
                ]
            ).select_from(stats_subquery)

            result = self.runner.session.execute(others_query).fetchone()

            if result:
                others_median, total_count, failed_count, impact_score = result

                logger.debug(
                    "Recomputed 'Others' (SQL): median=%s, failed=%d/%d, impact=%.3f",
                    others_median,
                    failed_count,
                    total_count,
                    impact_score,
                )

                return {
                    DIMENSION_VALUE_KEY: DIMENSION_OTHERS_LABEL,
                    Metrics.MEDIAN.name: others_median,
                    DIMENSION_TOTAL_COUNT_KEY: total_count,
                    DIMENSION_FAILED_COUNT_KEY: failed_count,
                    DIMENSION_IMPACT_SCORE_KEY: impact_score,
                }

            return None

        except Exception as exc:
            logger.warning(
                "Failed to recompute 'Others' median, will be excluded: %s", exc
            )
            logger.debug("Full error details: ", exc_info=True)
            return None
